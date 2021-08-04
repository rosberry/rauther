package controllers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/rosberry/rauther/example/custom/full/models"
)

type (
	SignUpRequest struct {
		Phone     string `json:"phone" binding:"required"`
		Password  string `json:"password" binding:"required"`
		Username  string `json:"username"  binding:"required"`
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
		Age       int    `json:"age"`
		Gender    string `json:"gender"`
	}

	SignInRequest struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
)

func (r *SignUpRequest) GetPID() (pid string)           { return r.Username }
func (r *SignUpRequest) GetPassword() (password string) { return r.Password }
func (r *SignUpRequest) Fields() map[string]string {
	return map[string]string{
		"phone":      r.Phone,
		"username":   r.Username,
		"first_name": r.FirstName,
		"last_name":  r.LastName,
		"gender":     r.Gender,
		"age":        strconv.Itoa(r.Age), // TODO: we should return map[string]iterface{}, but ...
	}
}

func (r *SignInRequest) GetPID() (pid string)           { return r.Username }
func (r *SignInRequest) GetPassword() (password string) { return r.Password }
func (r *SignInRequest) Fields() map[string]string { // TODO: interface with Fields() should not be required
	return map[string]string{}
}

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
