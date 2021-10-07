package main

import (
	"context"
	"os"

	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/aws/aws-sdk-go/service/s3/s3manager"
	"github.com/mkideal/cli"
	log "github.com/sirupsen/logrus"
	"github.com/threehook/cdk-utils/deploycode/cloudformation"
)

const (
	tmpFile = "/tmp/source"
)

type args struct {
	cli.Helper
	InputTemplate  string `cli:"*i,input" usage:"Path to the input template file"`
	ArtifactBucket string `cli:"*b,bucket" usage:"Bucket name of the artifact bucket"`
	OutputTemplate string `cli:"*o,output" usage:"Path to the output template file"`
	RootDirectory  string `cli:"r,root" usage:"The root directory for the input and output path" dft:"$CODEBUILD_SRC_DIR"`
	Verbose        bool   `cli:"v,verbose" usage:"Output more logging information"`
}

func (a *args) input() string {
	return a.InputTemplate
}

func (a *args) output() string {
	return a.OutputTemplate
}

func (a *args) absolute(relative string) string {
	return a.RootDirectory + "/" + relative
}

var root = &cli.Command{
	Desc: "Deploys the code to artifact bucket and updates the Cloud Formation template with the locations in the bucket",
	Argv: func() interface{} { return new(args) },
	Fn:   cliMain,
}

var (
	s        = session.Must(session.NewSession())
	svc      = s3.New(s)
	uploader = s3manager.NewUploader(s)
)

func main() {
	if err := cli.Root(root).Run(os.Args[1:]); err != nil {
		log.WithError(err).Error("error happened")
		os.Exit(1)
	}
}

func cliMain(cliCtx *cli.Context) error {
	args := cliCtx.Argv().(*args)
	if args.Verbose {
		log.SetLevel(log.TraceLevel)
	} else {
		log.SetLevel(log.InfoLevel)
	}
	mainLog := log.WithField("args", args)
	mainLog.Trace("received args")

	template, err := cloudformation.ReadTemplateFromFile(args.input())
	if err != nil {
		mainLog.WithError(err).Error("input template file does not contain readable template")
		return err
	}

	err = deployCodeAndUpdateTemplate(context.Background(), template, args)
	if err != nil {
		return err
	}

	err = cloudformation.WriteTemplateToFile(template, args.output())
	if err != nil {
		mainLog.WithError(err).Error("could not write output template")
		return err
	}
	return nil
}

func deployCodeAndUpdateTemplate(ctx context.Context, t *cloudformation.Template, args *args) error {
	var parametersToRemove []string
	functions := cloudformation.GetAllFunctionResources(t.Resources)

	for name := range functions {
		logFc := log.WithField("function", name)
		logFc.Info("handling function")
		fc := t.Resources[name]
		path, err := cloudformation.RemovePath(&fc)
		if err != nil {
			logFc.Trace("no path found, skipping function")
			continue
		}
		source := args.absolute(path)

		S3Key, err := uploadSource(ctx, args.ArtifactBucket, source)
		if err != nil {
			logFc.WithError(err).Error("could not upload code")
			return err
		}

		originalS3BucketRef, originalS3KeyRef := cloudformation.ReplaceCode(&fc, cloudformation.Code{
			S3Bucket: args.ArtifactBucket,
			S3Key:    S3Key,
		})

		parametersToRemove = append(parametersToRemove, originalS3BucketRef, originalS3KeyRef)
	}

	log.WithField("parameters", parametersToRemove).Trace("removing parameters")
	t.RemoveParameters(parametersToRemove)
	return nil
}
