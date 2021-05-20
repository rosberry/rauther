package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/rosberry/rauther/example/basic/controllers"
)

func main() {
	log.Print("It's basic example for rauther lib")

	r := gin.Default()
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"message": "pong",
		})
	})

	r.GET("/profile", controllers.Profile)

	r.Run()
}
