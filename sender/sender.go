package sender

import (
	"encoding/base64"
	"fmt"
	"log"
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
func NewDefaultEmailSender(cr EmailCredentials, sj Subjects, m Messages) (Sender, error) {
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

	if err := s.validate(); err != nil {
		return s, err
	}

	return s, nil
}

type defaultEmailSender struct {
	Credentials EmailCredentials
	Subjects
	Messages
}

func (sender defaultEmailSender) validate() error {
	log.Print("Start validate smtp connect for default email sender")

	client, err := smtp.Dial(sender.getProvider())
	if err != nil {
		return fmt.Errorf("smtp connect error: %w", err)
	}

	defer client.Close()

	return nil
}

func (sender defaultEmailSender) Send(event Event, recipient string, message string) error {
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
		sender.getProvider(),
		sender.getAuth(),
		from.Address,
		[]string{to.Address},
		[]byte(body),
	)
	if err != nil {
		return fmt.Errorf("smtp send message error: %w", err)
	}

	return nil
}

func (sender defaultEmailSender) RecipientKey() string {
	return "email"
}

func (sender defaultEmailSender) getProvider() string {
	return fmt.Sprintf("%s:%v", sender.Credentials.Server, sender.Credentials.Port)
}

func (sender defaultEmailSender) getAuth() smtp.Auth {
	return smtp.PlainAuth(
		"",
		sender.Credentials.From,
		sender.Credentials.Pass,
		sender.Credentials.Server,
	)
}
