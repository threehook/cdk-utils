package cloudformation

import "errors"

// Code represents the location of the code of the lambda function
type Code struct {
	S3Bucket string `json:"S3Bucket"`
	S3Key    string `json:"S3Key"`
}

// GetAllFunctionResources filters the resources and only returns the resources that are Lambda functions
func GetAllFunctionResources(resources map[string]Resource) map[string]Resource {
	results := map[string]Resource{}
	for name, resource := range resources {
		if resource.Type == "AWS::Lambda::Function" {
			results[name] = resource
		}
	}
	return results
}

// RemovePath removes the path from the tags and returns the path
func RemovePath(fc *Resource) (string, error) {
	tags := fc.Properties["Tags"].([]interface{})
	for i, untypedTag := range tags {
		tag := untypedTag.(map[string]interface{})
		if tag["Key"] == "dpg:lambda:path" {
			newTags := append(tags[:i], tags[i+1:]...)
			fc.Properties["Tags"] = newTags
			return tag["Value"].(string), nil
		}
	}
	return "", errors.New("path not found")
}

// ReplaceCode replaces the code with the new code and returns the original references
func ReplaceCode(fc *Resource, newCode Code) (string, string) {
	code := fc.Properties["Code"].(map[string]interface{})
	fc.Properties["Code"] = newCode
	return getRef(code["S3Bucket"]), getRef(code["S3Key"])
}

func getRef(untyped interface{}) string {
	item := untyped.(map[string]interface{})
	return item["Ref"].(string)
}
