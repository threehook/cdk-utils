package cloudformation

import (
	"encoding/json"
)

// Template represents an AWS CloudFormation template
// see: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/template-anatomy.html
type Template struct {
	AWSTemplateFormatVersion string                 `json:"AWSTemplateFormatVersion,omitempty"`
	Transform                *Transform             `json:"Transform,omitempty"`
	Description              string                 `json:"Description,omitempty"`
	Metadata                 map[string]interface{} `json:"Metadata,omitempty"`
	Parameters               map[string]interface{} `json:"Parameters,omitempty"`
	Mappings                 map[string]interface{} `json:"Mappings,omitempty"`
	Conditions               map[string]interface{} `json:"Conditions,omitempty"`
	Resources                map[string]Resource    `json:"Resources,omitempty"`
	Outputs                  map[string]interface{} `json:"Outputs,omitempty"`
}

// RemoveParameters removes the parameters with the names
func (t *Template) RemoveParameters(names []string) {
	parameters := t.Parameters
	for name := range parameters {
		for _, parameterToRemove := range names {
			if name == parameterToRemove {
				delete(parameters, name)
			}
		}
	}
}

// Parameter represents the parameter in the template
type Parameter struct {
	Type                  string   `json:"Type"`
	Description           string   `json:"Description,omitempty"`
	Default               string   `json:"Default,omitempty"`
	AllowedPattern        string   `json:"AllowedPattern,omitempty"`
	AllowedValues         []string `json:"AllowedValues,omitempty"`
	ConstraintDescription string   `json:"ConstraintDescription,omitempty"`
	MaxLength             int      `json:"MaxLength,omitempty"`
	MinLength             int      `json:"MinLength,omitempty"`
	MaxValue              float64  `json:"MaxValue,omitempty"`
	MinValue              float64  `json:"MinValue,omitempty"`
	NoEcho                bool     `json:"NoEcho,omitempty"`
}

// Resource represents any kind of resource and only contains the elements that all resources contain
type Resource struct {
	Type                string                 `json:"Type"`
	Properties          map[string]interface{} `json:"Properties"`
	DependsOn           []string               `json:"DependsOn,omitempty"`
	Metadata            map[string]interface{} `json:"Metadata,omitempty"`
	DeletionPolicy      string                 `json:"DeletionPolicy,omitempty"`
	UpdateReplacePolicy string                 `json:"UpdateReplacePolicy,omitempty"`
	Condition           string                 `json:"Condition,omitempty"`
}

// Transform is the part of the template regarding its transform
type Transform struct {
	String *string

	StringArray *[]string
}

func (t Transform) value() interface{} {
	if t.String != nil {
		return t.String
	}

	if t.StringArray != nil {
		return t.StringArray
	}

	return nil
}

// MarshalJSON marshals the Transform
func (t *Transform) MarshalJSON() ([]byte, error) {
	return json.Marshal(t.value())
}

// UnmarshalJSON unmarshals the Transform
func (t *Transform) UnmarshalJSON(b []byte) error {
	var typecheck interface{}
	if err := json.Unmarshal(b, &typecheck); err != nil {
		return err
	}

	switch val := typecheck.(type) {

	case string:
		t.String = &val

	case []string:
		t.StringArray = &val

	case []interface{}:
		var strslice []string
		for _, i := range val {
			switch str := i.(type) {
			case string:
				strslice = append(strslice, str)
			}
		}
		t.StringArray = &strslice
	}

	return nil
}

// NewTemplate creates a new AWS CloudFormation template struct
func NewTemplate() *Template {
	return &Template{
		AWSTemplateFormatVersion: "2010-09-09",
		Description:              "",
		Metadata:                 map[string]interface{}{},
		Parameters:               map[string]interface{}{},
		Mappings:                 map[string]interface{}{},
		Conditions:               map[string]interface{}{},
		Resources:                map[string]Resource{},
		Outputs:                  map[string]interface{}{},
	}
}

// JSON converts an AWS CloudFormation template object to JSON
func (t *Template) JSON() ([]byte, error) {

	j, err := json.MarshalIndent(t, "", "  ")
	if err != nil {
		return nil, err
	}

	return j, nil

}
