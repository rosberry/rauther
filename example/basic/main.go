package main

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rosberry/rauther"
	"github.com/rosberry/rauther/authtype"
	"github.com/rosberry/rauther/deps"
	"github.com/rosberry/rauther/example/basic/controllers"
	"github.com/rosberry/rauther/example/basic/models"
	"github.com/rosberry/rauther/sender"
)

func main() {
	log.Print("It's basic example for rauther lib")

	r := gin.Default()
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "pong",
		})
	})

	d := deps.New(
		r,
		deps.Storage{
			SessionStorer: &models.Sessioner{
				Sessions: make(map[string]*models.Session),
			},
			UserStorer: &models.UserStorer{
				Users: make(map[string]*models.User),
			},
		},
	)

	stdEmailSender, err := sender.NewDefaultEmailSender(sender.EmailCredentials{
		Server:   "smtp.gmail.com",
		Port:     587,
		From:     "example@gmail.com",
		FromName: "name",
		Pass:     "xxx",
	}, nil, nil)
	if err != nil {
		log.Fatal(err)
	}

	d.Types = authtype.New(nil).
		Add("email", stdEmailSender, nil, nil).
		Add("pochta", &fakeEmailSender{}, &customReqEmail{}, &customReqEmail{}).
		Add("username", &fakeEmailSender{}, &authtype.SignUpRequestByUsername{}, &authtype.SignUpRequestByUsername{}).
		Add("custom", &fakeSmsSender{}, &customReq2{}, &customReq2{})

	rauth := rauther.New(d)
	// rauth.Modules.ConfirmableUser = false

	r.GET("/profile", rauth.AuthMiddleware(), controllers.Profile)

	err = rauth.InitHandlers()
	if err != nil {
		log.Print(err)
	}

	err = r.Run()
	if err != nil {
		log.Fatal(err)
	}
}

type fakeEmailSender struct{}

func (s *fakeEmailSender) Send(event sender.Event, recipient string, message string) error {
	log.Printf("Send '%s' to %v by email", message, recipient)
	return nil
}

func (s *fakeEmailSender) RecipientKey() string {
	return "email"
}

type fakeSmsSender struct{}

func (s *fakeSmsSender) Send(event sender.Event, recipient string, message string) error {
	log.Printf("Send '%s' to %v by sms", message, recipient)
	return nil
}

func (s *fakeSmsSender) RecipientKey() string {
	return "phone"
}

type customReqEmail struct {
	Email    string `json:"pochta"`
	Password string `json:"parol"`
}

func (r customReqEmail) GetPID() (pid string)           { return r.Email } // trim spaces, toLower
func (r customReqEmail) GetPassword() (password string) { return r.Password }
func (r customReqEmail) Fields() map[string]string      { return map[string]string{"email": r.Email} }

type customReq2 struct {
	Username  string `json:"username"`
	Email     string `json:"email"`
	Password  string `json:"password"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
}

func (r customReq2) GetPID() (pid string)           { return r.Email } // trim spaces, toLower
func (r customReq2) GetPassword() (password string) { return r.Password }

func (r customReq2) Fields() map[string]string {
	return map[string]string{
		"email":    r.Email,
		"username": r.Username,
		"fname":    r.FirstName,
		"lname":    r.LastName,
	}
}
