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
)

func main() {
	log.Print("It's basic example for rauther lib")

	r := gin.Default()
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "pong",
		})
	})

	rauth := rauther.New(
		deps.New(r,
			deps.Storage{
				SessionStorer: &models.Sessioner{
					Sessions: make(map[string]*models.Session),
				},
				UserStorer: &models.UserStorer{
					Users: make(map[string]*models.User),
				},
			},
			Senders: map[string]interface{}{
				"email": "EmailSender",
				"sms": "SMSSender",
				"phone": "PhoneCaller",
			},
			SenderSelector: func(c *gin.Context) string {
				senderType := c.Query("type")
				return senderType
			}
		))

	// rauth.Config.CreateGuestUser = false
	// rauth.Modules.AuthableUser = false

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
