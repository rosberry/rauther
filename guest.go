package rauther

import (
	"github.com/rosberry/rauther/common"
	"github.com/rosberry/rauther/user"
)

func (r *Rauther) createGuestUser() (user.User, common.ErrTypes) {
	usr := r.deps.UserStorer.Create()
	usr.(user.GuestUser).SetGuest(true)

	err := r.deps.UserStorer.Save(usr)
	if err != nil {
		return nil, common.ErrUserSave
	}

	return usr, common.ErrTypes(0)
}
