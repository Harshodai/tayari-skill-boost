package main

import (
	"encoding/binary"
	"encoding/json"
	"errors"
	"io"
	"os"
)

const maxMessageSize = 1024 * 1024

func ReadMessage(target any) error {
	var length uint32
	if err := binary.Read(os.Stdin, binary.LittleEndian, &length); err != nil {
		return err
	}
	if length == 0 || length > maxMessageSize {
		return errors.New("invalid native message length")
	}
	payload := make([]byte, length)
	if _, err := io.ReadFull(os.Stdin, payload); err != nil {
		return err
	}
	return json.Unmarshal(payload, target)
}
func WriteMessage(value any) error {
	payload, err := json.Marshal(value)
	if err != nil {
		return err
	}
	if len(payload) > maxMessageSize {
		return errors.New("native response is too large")
	}
	if err := binary.Write(os.Stdout, binary.LittleEndian, uint32(len(payload))); err != nil {
		return err
	}
	if _, err := os.Stdout.Write(payload); err != nil {
		return err
	}
	return os.Stdout.Sync()
}
