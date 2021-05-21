package rauther_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/rosberry/rauther"
	"github.com/rosberry/rauther/common"
	. "github.com/smartystreets/goconvey/convey"
)

func TestNewRauther(t *testing.T) {
	Convey("We want to create Rauther correct", t, func() {
		Convey("Given dependencies for Rauther", func() {
			// create dependencies
			sessioner := sessionStorer{}
			r := gin.Default()

			deps := rauther.Deps{
				R:             r,
				SessionStorer: &sessioner,
			}
			Convey("When we create new instance of Rauther", func() {
				// create Rauther
				rauth := rauther.New(deps)
				Convey("Then instance not nil", func() {
					So(rauth, ShouldNotBeNil)
					Convey("And config contain default values", func() {
						So(rauth.Config.AuthPath, ShouldEqual, "auth")
						So(rauth.Config.SessionToken, ShouldEqual, "session")
						So(rauth.Config.SessionCtxName, ShouldEqual, "session")
					})
				})
			})
		})
	})
}

func TestDefaultAuthRouter(t *testing.T) {
	Convey("We want have default /auth router", t, func() {
		Convey("Given correctly created instance of Rauther", func() {
			sessioner := sessionStorer{
				Sessions: make(map[string]*Session),
			}
			r := gin.Default()

			deps := rauther.Deps{
				R:             r,
				SessionStorer: &sessioner,
			}

			_ = rauther.New(deps)
			Convey("When we send request to /auth with some session value", func() {
				sessionID := "test_session"
				request, _ := http.NewRequest(http.MethodPost, fmt.Sprintf("/auth?session=%s", sessionID), nil)
				rr := httptest.NewRecorder()
				r.ServeHTTP(rr, request)
				Convey("Then response should be correct", func() {
					resp := struct {
						Result bool
						Token  string
					}{}

					json.Unmarshal(rr.Body.Bytes(), &resp)

					So(rr.Code, ShouldEqual, http.StatusOK)
					So(resp.Result, ShouldBeTrue)
					So(resp.Token, ShouldNotBeEmpty)
				})
			})
			Convey("When we send request to /auth without session value", func() {
				sessionID := ""
				request, _ := http.NewRequest(http.MethodPost, fmt.Sprintf("/auth?session=%s", sessionID), nil)
				rr := httptest.NewRecorder()
				r.ServeHTTP(rr, request)
				Convey("Then response should return error", func() {
					resp := struct {
						Result bool
						Token  string
						Error  struct {
							Code    string
							Message string
						}
					}{}

					json.Unmarshal(rr.Body.Bytes(), &resp)

					So(rr.Code, ShouldEqual, http.StatusUnauthorized)
					So(resp.Result, ShouldBeFalse)
					So(resp.Error.Code, ShouldNotBeEmpty)
					So(resp.Error.Message, ShouldNotBeEmpty)
					So(resp.Token, ShouldBeEmpty)
				})
			})
			Convey("When we send request to /auth", func() {
				Convey("And Rauther.SessionStorer Load() return nil Session", func() {
					sessionID := "nil"
					request, _ := http.NewRequest(http.MethodPost, fmt.Sprintf("/auth?session=%s", sessionID), nil)
					rr := httptest.NewRecorder()
					r.ServeHTTP(rr, request)
					Convey("Then response should return error", func() {
						resp := struct {
							Result bool
							Token  string
							Error  struct {
								Code    string
								Message string
							}
						}{}

						json.Unmarshal(rr.Body.Bytes(), &resp)

						So(rr.Code, ShouldEqual, http.StatusInternalServerError)
						So(resp.Result, ShouldBeFalse)
						So(resp.Error.Code, ShouldNotBeEmpty)
						So(resp.Error.Message, ShouldNotBeEmpty)
						So(resp.Token, ShouldBeEmpty)
					})
				})
				Convey("And Rauther.SessionStorer Save() return error", func() {
					sessionID := "error_session"
					request, _ := http.NewRequest(http.MethodPost, fmt.Sprintf("/auth?session=%s", sessionID), nil)
					rr := httptest.NewRecorder()
					r.ServeHTTP(rr, request)
					Convey("Then response should return error", func() {
						resp := struct {
							Result bool
							Token  string
							Error  struct {
								Code    string
								Message string
							}
						}{}

						json.Unmarshal(rr.Body.Bytes(), &resp)

						So(rr.Code, ShouldEqual, http.StatusInternalServerError)
						So(resp.Result, ShouldBeFalse)
						So(resp.Error.Code, ShouldNotBeEmpty)
						So(resp.Error.Message, ShouldNotBeEmpty)
						So(resp.Token, ShouldBeEmpty)
					})
				})
			})
		})
	})
}

func TestAuthMiddleware(t *testing.T) {
	Convey("We want have auth session middleware", t, func() {
		type response struct {
			Result  bool
			Session struct {
				SessionID string
				Token     string
			}
			Error struct {
				Code    string
				Message string
			}
		}
		Convey("Given correctly created instance of Rauther", func() {
			sessioner := sessionStorer{
				Sessions: map[string]*Session{
					"t1": {
						SessionID: "t1",
						Token:     "success_token",
					},
				},
			}
			r := gin.Default()

			deps := rauther.Deps{
				R:             r,
				SessionStorer: &sessioner,
			}

			rauth := rauther.New(deps)
			Convey("And router with connected auth middleware", func() {
				r.GET("/mw", rauth.AuthMiddleware(), func(c *gin.Context) {
					if session, ok := c.Get(rauth.SessionCtxName); ok {
						c.JSON(http.StatusOK, gin.H{
							"result":  true,
							"session": session.(*Session),
						})

						return
					}
					c.JSON(http.StatusBadRequest, gin.H{
						"result":  false,
						"session": nil,
					})
				})

				Convey("Then we not have Bearer token", func() {
					Convey("And send request", func() {
						request, _ := http.NewRequest(http.MethodGet, "/mw", nil)
						rr := httptest.NewRecorder()
						r.ServeHTTP(rr, request)
						Convey("Then response should return error", func() {
							resp := response{}

							json.Unmarshal(rr.Body.Bytes(), &resp)

							So(rr.Code, ShouldEqual, http.StatusUnauthorized)
							So(resp.Result, ShouldBeFalse)
							So(resp.Error.Code, ShouldNotBeEmpty)
							So(resp.Error.Code, ShouldEqual, common.Errors[common.ErrNotAuth].Code)

							So(resp.Error.Message, ShouldNotBeEmpty)
							So(resp.Error.Message, ShouldEqual, common.Errors[common.ErrNotAuth].Message)
							So(resp.Session, ShouldBeZeroValue)
						})
					})
				})
				Convey("Then we have incorrect Bearer token", func() {
					Convey("And send request", func() {
						request, _ := http.NewRequest(http.MethodGet, "/mw", nil)
						request.Header.Add("Authorization", "IncorrectBearerToken")
						rr := httptest.NewRecorder()
						r.ServeHTTP(rr, request)
						Convey("Then response should return error", func() {
							resp := response{}

							json.Unmarshal(rr.Body.Bytes(), &resp)

							So(rr.Code, ShouldEqual, http.StatusUnauthorized)
							So(resp.Result, ShouldBeFalse)
							So(resp.Error.Code, ShouldNotBeEmpty)
							So(resp.Error.Code, ShouldEqual, common.Errors[common.ErrNotAuth].Code)

							So(resp.Error.Message, ShouldNotBeEmpty)
							So(resp.Error.Message, ShouldEqual, common.Errors[common.ErrNotAuth].Message)
							So(resp.Session, ShouldBeZeroValue)
						})
					})
				})
				Convey("Then we have empty Bearer token", func() {
					Convey("And send request", func() {
						request, _ := http.NewRequest(http.MethodGet, "/mw", nil)
						request.Header.Add("Authorization", "Bearer")
						rr := httptest.NewRecorder()
						r.ServeHTTP(rr, request)
						Convey("Then response should return error", func() {
							resp := response{}

							json.Unmarshal(rr.Body.Bytes(), &resp)

							So(rr.Code, ShouldEqual, http.StatusUnauthorized)
							So(resp.Result, ShouldBeFalse)
							So(resp.Error.Code, ShouldNotBeEmpty)
							So(resp.Error.Code, ShouldEqual, common.Errors[common.ErrNotAuth].Code)

							So(resp.Error.Message, ShouldNotBeEmpty)
							So(resp.Error.Message, ShouldEqual, common.Errors[common.ErrNotAuth].Message)
							So(resp.Session, ShouldBeZeroValue)
						})
					})
				})
				Convey("Then we have correct not exist Bearer token", func() {
					Convey("And send request", func() {
						request, _ := http.NewRequest(http.MethodGet, "/mw", nil)
						request.Header.Add("Authorization", "Bearer token123")
						rr := httptest.NewRecorder()
						r.ServeHTTP(rr, request)
						Convey("Then response should return error", func() {
							resp := response{}

							json.Unmarshal(rr.Body.Bytes(), &resp)

							So(rr.Code, ShouldEqual, http.StatusUnauthorized)
							So(resp.Result, ShouldBeFalse)

							So(resp.Error.Code, ShouldNotBeEmpty)
							So(resp.Error.Code, ShouldEqual, common.Errors[common.ErrAuthFailed].Code)

							So(resp.Error.Message, ShouldNotBeEmpty)
							So(resp.Error.Message, ShouldEqual, common.Errors[common.ErrAuthFailed].Message)

							So(resp.Session, ShouldBeZeroValue)
						})
					})
				})
				Convey("Then we have correct Bearer token", func() {
					Convey("And send request", func() {
						request, _ := http.NewRequest(http.MethodGet, "/mw", nil)
						request.Header.Add("Authorization", "Bearer success_token")
						rr := httptest.NewRecorder()
						r.ServeHTTP(rr, request)
						Convey("Then response should be successed", func() {
							resp := response{}

							json.Unmarshal(rr.Body.Bytes(), &resp)

							So(rr.Code, ShouldEqual, http.StatusOK)
							So(resp.Result, ShouldBeTrue)
							So(resp.Error.Code, ShouldBeEmpty)
							So(resp.Error.Message, ShouldBeEmpty)
							So(resp.Session, ShouldNotBeEmpty)
						})
					})
				})
			})
		})
	})
}
