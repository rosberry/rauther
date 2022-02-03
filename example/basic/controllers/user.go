package controllers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rosberry/rauther/example/basic/models"
	"github.com/rs/zerolog/log"
)

func Profile(c *gin.Context) {
	u, ok := c.Get("user")
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{
			"result":  false,
			"message": "not found user in context",
		})

		return
	}

	user, ok := u.(*models.User)
	if !ok {
		log.Print("failed session type assertion")
		c.JSON(http.StatusForbidden, gin.H{
			"result":  false,
			"message": "failed type assertion",
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"result": true,
		"user":   user,
	})
}

func UpdateProfile(c *gin.Context, us *models.UserStorer) {
	u, ok := c.Get("user")
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{
			"result":  false,
			"message": "not found user in context",
		})

		return
	}

	user, ok := u.(*models.User)
	if !ok {
		log.Print("failed session type assertion")
		c.JSON(http.StatusForbidden, gin.H{
			"result":  false,
			"message": "failed type assertion",
		})

		return
	}

	type updateRequest struct {
		Username  string `json:"username"`
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
	}

	var request updateRequest

	err := c.Bind(&request)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"result":  false,
			"message": "bad request, mf",
		})

		return
	}

	user.Username = request.Username
	user.FirstName = request.FirstName
	user.LastName = request.LastName

	us.Save(user)

	c.JSON(http.StatusOK, gin.H{
		"result": true,
		"user":   user,
	})
}

func RemoveAll(c *gin.Context, ss *models.Sessioner, us *models.UserStorer) {
	for _, ses := range ss.Sessions {
		err := ss.RemoveByID(ses.GetID())
		if err != nil {
			log.Print(err)
		}
	}

	for _, user := range us.Users {
		err := us.RemoveByID(user.ID)
		if err != nil {
			log.Print(err)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"result": true,
	})
}
