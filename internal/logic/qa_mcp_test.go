package logic

import (
	"context"
	"testing"
	"time"

	xSnowflake "github.com/bamboo-services/bamboo-base-go/common/snowflake"
	"github.com/xiaolfeng/Lumina/internal/entity"
	"gorm.io/datatypes"
)

func TestSupplementDeniedByQuestionStatus(t *testing.T) {
	t.Parallel()

	cases := []struct {
		status string
		want   string
	}{
		{status: "pending", want: ""},
		{status: "answered", want: "问题已回答，无法推送补充内容"},
		{status: "skipped", want: "问题已跳过，无法推送补充内容"},
		{status: "", want: ""},
	}
	for _, tc := range cases {
		if got := supplementDeniedByQuestionStatus(tc.status); got != tc.want {
			t.Errorf("supplementDeniedByQuestionStatus(%q) = %q, want %q", tc.status, got, tc.want)
		}
	}
}

func TestQuestionHasOption(t *testing.T) {
	t.Parallel()

	options := datatypes.JSON([]byte(`[{"id":"opt-1","label":"A"},{"id":"opt-2","label":"B"}]`))

	if !questionHasOption(options, "opt-1") {
		t.Error("expected opt-1 to belong to the question")
	}
	if questionHasOption(options, "opt-missing") {
		t.Error("expected missing option to be rejected")
	}
	if questionHasOption(nil, "opt-1") {
		t.Error("expected empty options to reject")
	}
	if questionHasOption(options, "") {
		t.Error("expected empty option id to reject")
	}
}

func TestToSessionResponse(t *testing.T) {
	t.Parallel()

	now := time.Now()
	projectID := xSnowflake.SnowflakeID(123456789)
	sessionID := xSnowflake.SnowflakeID(987654321)

	session := &entity.QaSession{
		Title:         "Test Session",
		Agent:         "TestAgent",
		Type:          "temporary",
		Status:        "active",
		ProjectID:     projectID,
		Hash:          "test-hash-1234",
		OnlineDevices: 2,
	}
	session.ID = sessionID
	session.CreatedAt = now
	session.UpdatedAt = now

	resp := toSessionResponse(session)

	if resp.ID != sessionID {
		t.Errorf("toSessionResponse() ID = %v, want %v", resp.ID, sessionID)
	}
	if resp.ProjectID != projectID {
		t.Errorf("toSessionResponse() ProjectID = %v, want %v", resp.ProjectID, projectID)
	}
	if resp.Hash != "test-hash-1234" {
		t.Errorf("toSessionResponse() Hash = %v, want %v", resp.Hash, "test-hash-1234")
	}
	if resp.Title != "Test Session" {
		t.Errorf("toSessionResponse() Title = %v, want %v", resp.Title, "Test Session")
	}
}

func TestResolveProjectName_SafeFallbacks(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	// 1. nil repo.project
	l := &QaLogic{}
	projectID := xSnowflake.SnowflakeID(123456789)
	if name := l.resolveProjectName(ctx, projectID); name != "" {
		t.Errorf("resolveProjectName with nil projectRepo = %q, want empty string", name)
	}

	// 2. zero projectID
	var zeroID xSnowflake.SnowflakeID
	if name := l.resolveProjectName(ctx, zeroID); name != "" {
		t.Errorf("resolveProjectName with zeroID = %q, want empty string", name)
	}
}
