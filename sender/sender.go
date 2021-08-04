package sender

import (
	"fmt"
	"log"
	"net/smtp"
)

type Sender interface {
	Send(event int, recipient string, message string) error
	RecipientKey() string
}

type EmailCredentials struct {
	Server   string
	Port     int
	Subjects map[int]string
	From     string
	FromName string
	Pass     string
	Message  string
}

type DefaultEmailSender struct {
	Credentials EmailCredentials
}

func (sender DefaultEmailSender) Send(event int, recipient string, message string) error {
	provider := fmt.Sprintf("%s:%v", sender.Credentials.Server, sender.Credentials.Port)
	from := fmt.Sprintf("%s <%s>", sender.Credentials.FromName, sender.Credentials.From)
	body := fmt.Sprintf(
		"To: %s\r\n"+
			"Subject: %s\r\n"+
			"\r\n"+
			"%s\r\n",
		recipient,
		sender.Credentials.Subjects[event],
		message,
	)

	err := smtp.SendMail(
		provider,
		smtp.PlainAuth(
			from,
			sender.Credentials.From,
			sender.Credentials.Pass,
			sender.Credentials.Server,
		),
		sender.Credentials.From,
		[]string{recipient},
		[]byte(body),
	)
	if err != nil {
		log.Printf("smtp error: %s", err)
		return err
	}
	return nil
}
