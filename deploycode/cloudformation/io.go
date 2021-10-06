package cloudformation

import (
	"encoding/json"
	"os"

	log "github.com/sirupsen/logrus"
)

// ReadTemplateFromFile reads the template of a file
func ReadTemplateFromFile(fileLocation string) (*Template, error) {
	logRead := log.WithField("fileLocation", fileLocation)
	file, err := os.Open(fileLocation)
	if err != nil {
		logRead.WithError(err).Error("could not read input template")
		return nil, err
	}
	defer func() {
		err := file.Close()
		if err != nil {
			logRead.WithError(err).Error("Error closing template input file")
		}
	}()

	var template Template
	err = json.NewDecoder(file).Decode(&template)
	return &template, err
}

// WriteTemplateToFile writes the template to a file
func WriteTemplateToFile(template *Template, fileLocation string) error {
	logWrite := log.WithField("fileLocation", fileLocation)
	output, err := os.Create(fileLocation)
	if err != nil {
		logWrite.WithError(err).Error("could not create output template")
		return err
	}
	jn, err := template.JSON()
	if err != nil {
		logWrite.WithError(err).Error("could not generate json")
	}
	_, err = output.Write(jn)
	return err
}
