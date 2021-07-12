package sender

import (
	"encoding/base64"
	"fmt"
	"mime"
	"net/mail"
	"net/smtp"
)

const (
	ConfirmationEvent Event = iota
	PasswordRecoveryEvent
)

type (
	Event int

	Sender interface {
		Send(event Event, recipient string, message string) error
		RecipientKey() string
	}

	EmailCredentials struct {
		Server   string
		Port     int
		From     string
		FromName string
		Pass     string
	}

	Subjects map[Event]string
	Messages map[Event]string
)

// NewDefaultEmailSender return Sender
// Argument 'Messages' should be exists '%s' symbols for use substring to wrap your dynamic message
func NewDefaultEmailSender(cr EmailCredentials, sj Subjects, m Messages) Sender {
	s := &defaultEmailSender{
		Credentials: cr,
		Subjects: Subjects{
			ConfirmationEvent:     "Code confirmation",
			PasswordRecoveryEvent: "Password recovery",
		},
		Messages: Messages{
			ConfirmationEvent:     "Your confirmation code is: %s. Please enter code in your app.",
			PasswordRecoveryEvent: "Your password recovery code is: %s. Please enter code in your app.",
		},
	}

	for key, item := range sj {
		s.Subjects[key] = item
	}

	for key, item := range m {
		s.Messages[key] = item
	}

	return s
}

type defaultEmailSender struct {
	Credentials EmailCredentials
	Subjects
	Messages
}

func (sender defaultEmailSender) Send(event Event, recipient string, message string) error {
	auth := smtp.PlainAuth(
		"",
		sender.Credentials.From,
		sender.Credentials.Pass,
		sender.Credentials.Server,
	)

	provider := fmt.Sprintf("%s:%v", sender.Credentials.Server, sender.Credentials.Port)
	title := sender.Subjects[event]
	from := mail.Address{
		Name:    sender.Credentials.FromName,
		Address: sender.Credentials.From,
	}
	to := mail.Address{
		Name:    recipient,
		Address: recipient,
	}

	header := map[string]string{
		"From":                      from.String(),
		"To":                        to.String(),
		"Subject":                   mime.QEncoding.Encode("UTF-8", title),
		"MIME-Version":              "1.0",
		"Content-Type":              "text/html; charset=\"utf-8\"",
		"Content-Transfer-Encoding": "base64",
	}

	message = fmt.Sprintf(sender.Messages[event], message)

	body := ""

	for key, val := range header {
		row := fmt.Sprintf("%s: %s\r\n", key, val)
		body += row
	}

	body += "\r\n" + base64.StdEncoding.EncodeToString([]byte(message))

	err := smtp.SendMail(
		provider,
		auth,
		from.Address,
		[]string{to.Address},
		[]byte(body),
	)
	if err != nil {
		return fmt.Errorf("smtp error: %w", err)
	}

	return nil
}

func (sender defaultEmailSender) RecipientKey() string {
	return "email"
}
