package rauther

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/rosberry/rauther/authtype"
	"github.com/rosberry/rauther/common"
	"github.com/rosberry/rauther/storage"
)

func (r *Rauther) includeSession() {
	r.deps.R.POST(r.Config.Routes.Auth, r.authHandler())

	withSession := r.deps.R.Group("", r.authMiddleware())
	{
		withSession.GET(r.Config.Routes.Auth, r.checkAuthHandler)

		if r.Modules.AuthableUser {
			r.includeAuthable(r.deps.R, withSession)
		}
	}
}

func (r *Rauther) includeAuthable(router *gin.RouterGroup, authRouter *gin.RouterGroup) {
	if !r.checker.Authable {
		log.Fatal(common.Errors[common.ErrAuthableUserNotImplement])
	}

	r.checkLink()
	r.checkRemovableUser()

	authRouter.POST(r.Config.Routes.SignOut, r.signOutHandler)

	if r.Modules.PasswordAuthableUser && r.methods.ExistingTypes[authtype.Password] {
		r.includePasswordAuthable(router, authRouter)
	}

	if r.Modules.SocialAuthableUser && r.methods.ExistingTypes[authtype.Social] {
		r.includeSocialAuthable(authRouter)
	}

	if r.Modules.OTP && r.methods.ExistingTypes[authtype.OTP] {
		r.includeOTPAuthable(authRouter)
	}
}

func (r *Rauther) includePasswordAuthable(router *gin.RouterGroup, authRouter *gin.RouterGroup) {
	if !r.checker.PasswordAuthable {
		log.Fatal(common.Errors[common.ErrPasswordAuthableUserNotImplement])
	}

	authRouter.POST(r.Config.Routes.SignUp, r.signUpHandler)
	authRouter.POST(r.Config.Routes.SignIn, r.signInHandler)
	authRouter.POST(r.Config.Routes.ValidateLoginField, r.validateLoginField)

	if r.Modules.ConfirmableUser {
		r.includeConfirmable(router, authRouter)
	}

	if r.Modules.RecoverableUser {
		r.includeRecoverable(authRouter)
	}

	if r.Modules.LinkAccount {
		withUser := authRouter.Group("", r.authUserMiddleware())
		{
			withUser.POST(r.Config.Routes.InitLink, r.initLinkingPasswordAccount)
			withUser.POST(r.Config.Routes.Link, r.linkPasswordAccount)
		}
	}
}

func (r *Rauther) includeSocialAuthable(router *gin.RouterGroup) {
	router.POST(r.Config.Routes.SocialSignIn, r.socialSignInHandler)
}

func (r *Rauther) includeOTPAuthable(router *gin.RouterGroup) {
	if !r.checker.OTPAuth {
		log.Fatal(common.Errors[common.ErrOTPNotImplement])
	}

	router.POST(r.Config.Routes.OTPRequestCode, r.otpGetCodeHandler)
	router.POST(r.Config.Routes.OTPCheckCode, r.otpAuthHandler)
}

func (r *Rauther) checkRemovableUser() {
	if r.Modules.GuestUser && !r.checker.Guest {
		log.Fatal("Please, implement GuestUser interface for use guest user")
	}

	if r.Modules.GuestUser || r.Modules.LinkAccount {
		if r.deps.Storage.UserRemover == nil {
			userRemover, isRemovable := r.deps.Storage.UserStorer.(storage.RemovableUserStorer)

			if !isRemovable {
				log.Fatal("If config approve guest then user storer must implement RemovableUserStorer interface. Change it.")
			}

			r.deps.Storage.UserRemover = userRemover
		}
	}
}

func (r *Rauther) checkLink() {
	if r.Modules.LinkAccount {
		if !r.Modules.ConfirmableUser {
			log.Fatal("Please, enable ConfirmableUser module for use linking")
		}

		if !r.checker.LinkAccount {
			log.Fatal("Please, implement TempUser interface for use linking")
		}
	}
}

func (r *Rauther) includeConfirmable(router *gin.RouterGroup, authRouter *gin.RouterGroup) {
	if !r.checker.Confirmable {
		log.Fatal(common.Errors[common.ErrConfirmableUserNotImplement])
	}

	if !r.checkSender() {
		log.Fatal(common.Errors[common.ErrSenderRequired])
	}

	authRouter.POST(r.Config.Routes.ConfirmResend, r.resendCodeHandler)
	router.POST(r.Config.Routes.ConfirmCode, r.confirmHandler)
}

func (r *Rauther) includeRecoverable(router *gin.RouterGroup) {
	if !r.checker.Recoverable {
		log.Fatal(common.Errors[common.ErrRecoverableUserNotImplement])
	}

	if !r.checkSender() {
		log.Fatal(common.Errors[common.ErrSenderRequired])
	}

	router.POST(r.Config.Routes.RecoveryRequest, r.requestRecoveryHandler)
	router.POST(r.Config.Routes.RecoveryValidateCode, r.validateRecoveryCodeHandler)
	router.POST(r.Config.Routes.RecoveryCode, r.recoveryHandler)
}

func (r *Rauther) checkSender() (ok bool) {
	if r.methods != nil && !r.methods.IsEmpty() {
		for _, t := range r.methods.List {
			if t.Sender == nil {
				if r.defaultSender == nil {
					log.Fatalf("If you not define auth sender - first define default sender\nDefaultSender(s sender.Sender)")
				}

				t.Sender = r.defaultSender
			}
		}
	} else if r.defaultSender == nil {
		return false
	}

	return true
}
