package main

import "testing"

func TestAllowedMethods(t *testing.T) {
  if !AllowedMethod("get_status") || !AllowedMethod("stop_task") || AllowedMethod("delete_everything") { t.Fatal("unexpected native method policy") }
}
func TestValidTaskID(t *testing.T) {
  if validTaskID("short") || !validTaskID("task-12345678") || validTaskID("task/unsafe-123") { t.Fatal("unexpected task id validation") }
}
