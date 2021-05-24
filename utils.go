package rauther

import (
	"github.com/gin-gonic/gin"
	"github.com/rosberry/rauther/common"
)

func errorResponse(c *gin.Context, status int, err common.Err) {
	c.JSON(status, gin.H{
		"result": false,
		"error":  err,
	})
}

func passwordCompare(password1, password2 string) (ok bool) {
	return password1 == password2
}
