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
		if r.Modules.AuthableUser {
			r.includeAuthabe(withSession)
		}
	}
}

func (r *Rauther) includeAuthabe(router *gin.RouterGroup) {
	if !r.checker.Authable {
		log.Fatal(common.Errors[common.ErrAuthableUserNotImplement])
	}

	r.checkRemovableUser()

	router.POST(r.Config.Routes.SignOut, r.signOutHandler())

	if r.Modules.PasswordAuthableUser && authtype.ExistingTypes[authtype.Password] {
		r.includePasswordAuthable(router)
	}

	if r.Modules.SocialAuthableUser && authtype.ExistingTypes[authtype.Social] {
		r.includeSocialAuthable(router)
	}

	if r.Modules.OTP && authtype.ExistingTypes[authtype.OTP] {
		r.includeOTPAuthable(router)
	}
}

func (r *Rauther) includePasswordAuthable(router *gin.RouterGroup) {
	if !r.checker.PasswordAuthable {
		log.Fatal(common.Errors[common.ErrPasswordAuthableUserNotImplement])
	}

	router.POST(r.Config.Routes.SignUp, r.signUpHandler())
	router.POST(r.Config.Routes.SignIn, r.signInHandler())
	router.POST(r.Config.Routes.ValidateLoginField, r.validateLoginField())

	if r.Modules.ConfirmableUser {
		r.includeConfirmable(router)
	}

	if r.Modules.RecoverableUser {
		r.includeRecoverable(router)
	}
}

func (r *Rauther) includeSocialAuthable(router *gin.RouterGroup) {
	r.checkRemovableUser()

	router.POST(r.Config.Routes.SocialSignIn, r.socialSignInHandler())
}

func (r *Rauther) includeOTPAuthable(router *gin.RouterGroup) {
	if !r.checker.OTPAuth {
		log.Fatal(common.Errors[common.ErrOTPNotImplement])
	}

	router.POST(r.Config.Routes.OTPRequestCode, r.otpGetCodeHandler())
	router.POST(r.Config.Routes.OTPCheckCode, r.otpAuthHandler())
}

func (r *Rauther) checkRemovableUser() {
	if r.Config.CreateGuestUser {
		if r.deps.Storage.UserRemover == nil {
			userRemover, isRemovable := r.deps.Storage.UserStorer.(storage.RemovableUserStorer)

			if !isRemovable {
				log.Fatal("If config approve guest then user storer must implement RemovableUserStorer interface. Change it.")
			}

			r.deps.Storage.UserRemover = userRemover
		}
	}
}

func (r *Rauther) includeConfirmable(router *gin.RouterGroup) {
	if !r.checker.Confirmable {
		log.Fatal(common.Errors[common.ErrConfirmableUserNotImplement])
	}

	if !r.checkSender() {
		log.Fatal(common.Errors[common.ErrSenderRequired])
	}

	router.POST(r.Config.Routes.ConfirmCode, r.confirmHandler())
	router.POST(r.Config.Routes.ConfirmResend, r.resendCodeHandler())
}

func (r *Rauther) includeRecoverable(router *gin.RouterGroup) {
	if !r.checker.Recoverable {
		log.Fatal(common.Errors[common.ErrRecoverableUserNotImplement])
	}

	if !r.checkSender() {
		log.Fatal(common.Errors[common.ErrSenderRequired])
	}

	router.POST(r.Config.Routes.RecoveryRequest, r.requestRecoveryHandler())
	router.POST(r.Config.Routes.RecoveryValidateCode, r.validateRecoveryCodeHandler())
	router.POST(r.Config.Routes.RecoveryCode, r.recoveryHandler())
}

func (r *Rauther) checkSender() (ok bool) {
	if r.types != nil && !r.types.IsEmpty() {
		for _, t := range r.types.List {
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
