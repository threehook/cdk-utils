package main

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/aws/aws-sdk-go/service/s3/s3manager"
	log "github.com/sirupsen/logrus"
)

func uploadSource(ctx context.Context, bucket string, source string) (string, error) {
	logSrc := log.WithField("bucket", bucket).WithField("source", source)
	logSrc.Trace("uploading source")

	zipFile, err := zipSource(source)
	if err != nil {
		return "", err
	}
	defer func() {
		err := zipFile.Close()
		if err != nil {
			log.WithError(err).Error("Error closing zip source file")
		}

		err = os.Remove(tmpFile + ".zip")
		if err != nil {
			log.WithError(err).Error("Error removing zip source file")
		}
	}()

	functionHash, err := functionHash(source)
	if err != nil {
		return "", err
	}
	functionHash = "cdk" + functionHash

	err = ensureCodeUploaded(ctx, bucket, functionHash, zipFile)
	return functionHash, err
}

func ensureCodeUploaded(ctx context.Context, bucket string, objectKey string, zipFile *os.File) error {
	logUpload := log.WithFields(log.Fields{"bucket": bucket, "objectKey": objectKey})

	_, err := svc.HeadObjectWithContext(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(objectKey),
	})

	if err != nil {
		if awsErr, ok := err.(awserr.Error); ok {
			switch awsErr.Code() {
			case "NotFound":
				resp, err := uploader.UploadWithContext(ctx, &s3manager.UploadInput{
					Bucket: aws.String(bucket),
					Key:    aws.String(objectKey),
					Body:   zipFile,
				})
				if err != nil {
					logUpload.WithError(err).Error("problem uploading file to S3")
					return err
				}
				logUpload.WithField("resp", resp).Trace("function uploaded to S3")
			default:
				logUpload.WithError(err).Error("problem validating if file exists on S3")
				return err
			}
		}
	} else {
		logUpload.Trace("function already uploaded to S3")
	}
	return nil
}

func zipSource(source string) (*os.File, error) {
	cmd := exec.Command("zip", "-r", tmpFile, ".")
	cmd.Dir = source
	err := cmd.Run()
	if err != nil {
		return nil, err
	}

	f, err := os.Open(tmpFile + ".zip")
	if err != nil {
		return nil, err
	}

	return f, nil
}

func functionHash(root string) (string, error) {
	hasher := sha1.New()

	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.Mode().IsRegular() {
			return nil
		}
		data, err := ioutil.ReadFile(path)
		if err != nil {
			return err
		}
		hasher.Write(data)
		return nil
	})

	return hex.EncodeToString(hasher.Sum(nil)), err
}
