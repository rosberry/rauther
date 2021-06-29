package sender

import (
	"fmt"
	"log"
	"net/smtp"

	"github.com/gin-gonic/gin"
)

type Sender interface {
	Send(event int, recipient string, message string) error
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

// SendersList by key (email, sms, phone, etc)
type SendersList map[string]Sender

// Selector should return sender key and can use gin context
type Selector func(c *gin.Context) (senderKey string)

type Senders struct {
	List     SendersList
	Selector Selector
}

// Select sender from senders list use Selector
func (s *Senders) Select(c *gin.Context) Sender {
	if s.Selector == nil {
		s.Selector = DefaultSenderSelector
	}

	senderKey := s.Selector(c)

	return s.List[senderKey]
}

func NewSenders(list SendersList, selector *Selector) *Senders {
	senders := &Senders{
		List:     list,
		Selector: DefaultSenderSelector,
	}

	if selector != nil {
		senders.Selector = *selector
	}

	return senders
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

func DefaultSenderSelector(c *gin.Context) string {
	const defaultKey = "email"

	type Request struct {
		Type string `json:"type"`
	}

	var r Request
	if err := c.Bind(&r); err != nil {
		return defaultKey
	}

	return r.Type
}
