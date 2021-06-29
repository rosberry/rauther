package main

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rosberry/rauther"
	"github.com/rosberry/rauther/authtype"
	"github.com/rosberry/rauther/common"
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

	rauth := rauther.New(deps.Deps{
		R: r,
		Storage: deps.Storage{
			SessionStorer: &models.Sessioner{
				Sessions: make(map[string]*models.Session),
			},
			UserStorer: nil,
		},
		Senders: sender.NewSenders(
			sender.SendersList{
				"email": sender.DefaultEmailSender{
					Credentials: sender.EmailCredentials{
						Server: "smtp.mail.ru",
						Port:   465,
						Subjects: map[int]string{
							common.CodeConfirmationEvent: "Code confirmation for App",
							common.PasswordRecoveryEvent: "Recovery password for App",
						},
						FromName: "My App",
						From:     "example@gmail.com",
						Pass:     "test",
					},
				},
			},
			nil,
		),
	})

	rauth.Config.AuthType = authtype.AuthByUsername

	r.GET("/profile", rauth.AuthMiddleware(), controllers.Profile)

	err := rauth.InitHandlers()
	if err != nil {
		log.Print(err)
	}

	err = r.Run()
	if err != nil {
		log.Fatal(err)
	}
}
