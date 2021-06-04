package main

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rosberry/rauther"
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

	rauth := rauther.New(rauther.Deps{
		R: r,
		SessionStorer: &models.Sessioner{
			Sessions: make(map[string]*models.Session),
		},

		UserStorer: nil,
		/*
			UserStorer: &models.UserStorer{
				Users: make(map[string]*models.User),
			},
		*/
	})

	// rauth.Config.CreateGuestUser = false
	// rauth.Modules.AuthableUser = false

	rauth.AuthType = rauther.AuthByUsername

	r.GET("/profile", rauth.AuthMiddleware(), controllers.Profile)

	err := rauth.InitHandlers()
	if err != nil {
		log.Print(err)
	}

	r.Run()
}
