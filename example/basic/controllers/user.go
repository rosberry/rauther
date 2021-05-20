package controllers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func Auth(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{
		"result": "false",
	})
}

func Profile(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{
		"result":  "false",
		"message": "example not implemented",
	})
}
