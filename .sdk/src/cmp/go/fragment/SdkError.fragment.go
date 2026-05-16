package ProjectNamePkg

import "fmt"

// ProjectNameError represents an SDK error.
type ProjectNameError struct {
	Code    string
	Message string
	SDK     string
}

func (e *ProjectNameError) Error() string {
	return fmt.Sprintf("%s: %s: %s", e.SDK, e.Code, e.Message)
}

func NewProjectNameError(code string, msg string) *ProjectNameError {
	return &ProjectNameError{
		Code:    code,
		Message: msg,
		SDK:     "ProjectName",
	}
}
