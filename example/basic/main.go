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

	sessioner := &models.Sessioner{
		Sessions: make(map[string]*models.Session),
	}

	useoner := &models.UserStorer{
		Users: make(map[string]*models.User),
	}

	rauth := rauther.New(rauther.Deps{
		R:             r,
		SessionStorer: sessioner,
		UserStorer:    useoner,
	})

	r.GET("/profile", rauth.AuthMiddleware(), controllers.Profile)

	err := r.Run()
	if err != nil {
		log.Print(err)
	}
}
