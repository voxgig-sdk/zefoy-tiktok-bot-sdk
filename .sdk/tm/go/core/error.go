package core

type ZefoyTiktokBotError struct {
	IsZefoyTiktokBotError bool
	Sdk              string
	Code             string
	Msg              string
	Ctx              *Context
	Result           any
	Spec             any
}

func NewZefoyTiktokBotError(code string, msg string, ctx *Context) *ZefoyTiktokBotError {
	return &ZefoyTiktokBotError{
		IsZefoyTiktokBotError: true,
		Sdk:              "ZefoyTiktokBot",
		Code:             code,
		Msg:              msg,
		Ctx:              ctx,
	}
}

func (e *ZefoyTiktokBotError) Error() string {
	return e.Msg
}
