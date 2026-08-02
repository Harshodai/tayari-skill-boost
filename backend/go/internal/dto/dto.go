package dto

const (
	MaxJobTypes         = 10
	MaxCompanyLength    = 200
	MaxJobTitleLength   = 200
	DefaultPage         = 1
	DefaultLimit        = 20
)

var acceptedJobTypes = map[string]bool{
	"FULLTIME": true, "PARTTIME": true, "CONTRACT": true, "INTERNSHIP": true,
	"TEMPORARY": true, "VOLUNTEER": true, "OTHER": true,
}

type JobSearchRequest struct {
	CandidateID string   `json:"candidateId" validate:"required,uuid4"`
	Query       string   `json:"query" validate:"required,min=2,max=100"`
	Location    string   `json:"location" validate:"omitempty,max=100"`
	JobTypes    []string `json:"jobTypes" validate:"omitempty,max=10,dive,oneof=FULLTIME PARTTIME CONTRACT INTERNSHIP TEMPORARY VOLUNTEER OTHER"`
	Page        int      `json:"page,omitempty" validate:"omitempty,gte=1"`
	Limit       int      `json:"limit,omitempty" validate:"omitempty,gte=1,lte=100"`
}

type CoverLetterGenRequest struct {
	CandidateID string `json:"candidateId" validate:"required,uuid4"`
	JobID       string `json:"jobId" validate:"required,uuid4"`
	Company     string `json:"company" validate:"required,max=200"`
	JobTitle    string `json:"jobTitle" validate:"required,max=200"`
	Tone        string `json:"tone" validate:"required,oneof=PROFESSIONAL CASUAL CONFIDENT"`
}
