package controllers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rosberry/rauther/example/default/full/models"
)

func Profile(c *gin.Context) {
	u, ok := c.Get("user")
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{
			"result":  "false",
			"message": "not found session",
		})

		return
	}

	user := u.(*models.User)

	c.JSON(http.StatusOK, gin.H{
		"result":  "true",
		"profile": user,
	})
}