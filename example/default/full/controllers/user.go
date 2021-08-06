package controllers

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rosberry/rauther/common"
	"github.com/rosberry/rauther/example/default/full/models"
)

func Profile(c *gin.Context) {
	u, ok := c.Get("user")
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"result": false,
			"error":  common.Errors[common.ErrUserNotFound],
		})

		return
	}

	user, ok := u.(*models.User)
	if !ok {
		log.Print("failed user type assertion to User")
	}

	c.JSON(http.StatusOK, gin.H{
		"result":  true,
		"profile": user,
	})
}
