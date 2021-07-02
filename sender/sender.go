package sender

import (
	"fmt"
	"log"
	"net/smtp"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
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
	list          SendersList
	Selector      Selector
	defaultSender Sender
}

// Select sender from senders list use Selector
func (s *Senders) Select(c *gin.Context) Sender {
	if s.Selector == nil {
		s.Selector = DefaultSenderSelector
	}

	senderKey := s.Selector(c)

	if sender, ok := s.list[senderKey]; ok {
		return sender
	}

	for _, v := range s.list {
		return v
	}

	return nil
}

func NewSenders(selector *Selector) *Senders {
	senders := &Senders{
		list:     make(SendersList),
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
	// return defaultKey

	type Request struct {
		Type string `json:"type"`
	}

	var r Request
	if err := c.ShouldBindBodyWith(&r, binding.JSON); err != nil {
		return defaultKey
	}

	return r.Type
}

func (s *Senders) AddSender(key string, sender Sender) *Senders {
	s.list[key] = sender
	if len(s.list) == 1 {
		sender, _ := s.list[key]
		s.defaultSender = sender
	}

	return s
}

func (s *Senders) IsEmpty() bool {
	return len(s.list) == 0
}
