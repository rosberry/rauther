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
