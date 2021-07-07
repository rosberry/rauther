package controllers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rosberry/rauther/example/basic/models"
)

func Profile(c *gin.Context) {
	s, ok := c.Get("user")
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{
			"result":  "false",
			"message": "not found session",
		})

		return
	}

	sess := s.(*models.User)

	c.JSON(http.StatusOK, gin.H{
		"result":  "true",
		"session": sess,
	})
}
