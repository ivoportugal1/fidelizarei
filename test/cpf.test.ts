import assert from "node:assert/strict";
import test from "node:test";
import { formatCpf, isValidCpf } from "../lib/cpf.ts";

test("accepts valid CPFs with or without formatting", () => {
  assert.equal(isValidCpf("529.982.247-25"), true);
  assert.equal(isValidCpf("52998224725"), true);
  assert.equal(isValidCpf("123.456.789-09"), true);
  assert.equal(isValidCpf(" 12345678909 "), true);
});

test("rejects repeated digits, wrong check digits and wrong length", () => {
  assert.equal(isValidCpf("111.111.111-11"), false);
  assert.equal(isValidCpf("000.000.000-00"), false);
  assert.equal(isValidCpf("123.456.789-00"), false);
  assert.equal(isValidCpf("1234567890"), false);
  assert.equal(isValidCpf(""), false);
});

test("formats CPF while typing", () => {
  assert.equal(formatCpf("1"), "1");
  assert.equal(formatCpf("1234"), "123.4");
  assert.equal(formatCpf("1234567"), "123.456.7");
  assert.equal(formatCpf("12345678909"), "123.456.789-09");
  assert.equal(formatCpf("123.456.789-09999"), "123.456.789-09");
  assert.equal(formatCpf("abc"), "");
});
