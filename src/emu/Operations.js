import winston from 'winston';

import {seg2abs, signExtend, twosComplement2Int8} from "./Utils";
import {
  regAH, regAL, regBH, regBL, regCH, regCL, regDH, regDL,
  regAX, regBX, regCX, regDX,
  regSI, regDI, regBP, regSP, regIP,
  regCS, regDS, regES, regSS,
  regFlags,
  FLAG_CF_MASK, FLAG_PF_MASK, FLAG_AF_MASK, FLAG_ZF_MASK, FLAG_SF_MASK,
  FLAG_TF_MASK, FLAG_IF_MASK, FLAG_DF_MASK, FLAG_OF_MASK,
  b, w, v, u,
} from './Constants';
import { binString16, formatFlags, hexString16 } from "./Debug";
import { FeatureNotImplementedException } from "./Exceptions";

const PARITY = [
/*         0  1  2  3  4  5  6  7  8  9  A  B  C  D  E  F
/* 0x00 */ 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1,
/* 0x10 */ 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0,
/* 0x20 */ 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0,
/* 0x30 */ 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1,
/* 0x40 */ 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0,
/* 0x50 */ 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1,
/* 0x60 */ 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1,
/* 0x70 */ 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0,
/* 0x80 */ 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0,
/* 0x90 */ 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1,
/* 0xA0 */ 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1,
/* 0xB0 */ 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0,
/* 0xC0 */ 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1,
/* 0xD0 */ 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0,
/* 0xE0 */ 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0,
/* 0xF0 */ 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1
];

export default class Operations {
  constructor(cpu) {
    this.cpu = cpu;
  }

  aaa (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  aad (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  aam (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }

  /**
   * AAS (ASCII Adjust for Subtraction) corrects the result of a previous
   * subtraction of two valid unpacked decimal operands (the destination
   * operand must have been specified as register AL). AAS changes the content
   * of AL to a valid unpacked decimal number; the high-order halfbyte is
   * zeroed. AAS updates AF and CF; the content of OF, PF, SF and ZF is
   * undefined following execution of AAS.
   *   - [1] p.2-36
   *
   * http://service.scs.carleton.ca/sivarama/asm_book_web/Instructor_copies/ch11_bcd.pdf
   * https://stackoverflow.com/a/24093050/1436323
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src Source addressing function
   * @return {number} Result of the operation
   */
  aas (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }

  adc (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }

  add (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  };

  and (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }

  /**
   * CALL activates an out-of-line procedure, saving information on the stack
   * to permit a RET (return) instruction in the procedure to transfer control
   * back to the instruction following the CALL. The assembler generates a
   * different type of CALL instruction depending on whether the programmer has
   * defined the procedure name as NEAR or FAR. For control to return properly,
   * the type of CALL instruction must match the type of RET instruction that
   * exits from the procedure. (The potential for a mismatch exists if the
   * procedure and the CALL are contained in separately assembled programs.)
   * Different forms of the CALL instruction allow the address of the target
   * procedure to be obtained from the instruction itself (direct CALL) or from
   * a memory location or register referenced by the instruction (indirect
   * CALL). In the following descriptions, bear in mind that the processor
   * automatically adjusts IP to point to the next instruction to be executed,
   * before saving it on the stack.
   *
   * For an intrasegment direct CALL, SP (the stack pointer) is decremented by
   * two and IP is pushed onto the stack. The relative displacement (up to
   * ±32k) of the target procedure from the CALL instruction is then added to
   * the instruction pointer. This form of the CALL instruction is
   * "self-relative" and is appropriate for position- independent (dynamically
   * relocatable) routines in which the CALL and its target are in the same
   * segment and are moved together.
   *
   * An intrasegment indirect CALL may be made through memory or through a
   * register. SP is decremented by two and IP is pushed onto the stack. The
   * offset of the target procedure is obtained from the memory word or 16-bit
   * general register referenced in the instruction and replaces IP.
   *
   * For an intersegment direct CALL, SP is decremented by two, and CS is
   * pushed onto the stack. CS is replaced by the segment word contained in the
   * instruction. SP again is decremented by two. IP is pushed onto the stack
   * and is replaced by the offset word contained in the instruction.
   *
   * For an intersegment indirect CALL (which only may be made through memory),
   * SP is decremented by two, and CS is pushed onto the stack. CS is then
   * replaced by the content of the second word oithe doubleword memory pointer
   * referenced by the instruction. SP again is decremented by two, and IP is
   * pushed onto the stack and is replaced by the content of the first word of
   * the doubleword pointer referenced by the instruction.
   *
   *   - [1] p.2-43 to 2.44
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src NOT USED
   * @return {boolean} True if the jump was made, false otherwise
   */
  call (dst, src) {
    let segment = this.cpu.reg16[regCS];
    let oper = dst(segment);

    switch (this.cpu.opcode.opcode_byte) {
      case 0x9A: // CALL Ap (far)
        this.push16(this.cpu.reg16[regCS]);
        this.push16(this.cpu.reg16[regIP]);
        this.cpu.reg16[regCS] = oper[0];
        this.cpu.reg16[regIP] = oper[1];
        break;
      case 0xE8: // CALL Jv (near)
        this.push16(this.cpu.reg16[regIP]);
        this.cpu.reg16[regIP] = oper;
        break;
      case 0xFF:
        if (this.cpu.opcode.reg === 2) { // 0xFF (2) CALL Ev (near)
          this.push16(this.cpu.reg16[regIP]);
          this.cpu.reg16[regIP] = oper;
        }
        else if (this.cpu.opcode.reg === 3) { // 0xFF (3) CALL Mp (far)
          this.push16(this.cpu.reg16[regCS]);
          this.push16(this.cpu.reg16[regIP]);
          this.cpu.reg16[regCS] = oper[0];
          this.cpu.reg16[regIP] = oper[1];
        }
        break;
    }
  }

  cbw (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  clc (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  cld (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  cli (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  cmc (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }

  /**
   * CMP (Compare) subtracts the source from the destination, which may be bytes
   * or words, but does not return the result. The operands are unchanged but
   * the flags are updated and can be tested by a subsequent conditional jump
   * instruction. CMP updates AF, CF, OF, PF, SF, and ZF. The comparison
   * reflected in the flags is that of the destination to the source. If a CMP
   * instruction is followed by a JG (jump if greater) instruction, for
   * example, the jump is taken if the destination operand is greater than the
   * source operand.
   *   - [1] p.2-36
   *
   * Modifies flags: AF CF OF PF SF ZF
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src Source addressing function
   * @return {number} Result of the operation
   */
  cmp (dst, src) {
    let segment = this.cpu.reg16[regCS];
    let d = dst(segment, null);
    let s = src(segment, null);
    if (this.cpu.opcode.addrSize === w || this.cpu.opcode.addrSize === v) {
      s = signExtend(s);
    }
    let result = d - s;

    // Handle underflow correctly
    if (result < 0) {
      if (this.cpu.opcode.addrSize === b)
        result = 0xFF + 1 + result;
      else if (this.cpu.opcode.addrSize === w)
        result = 0xFFFF + 1 + result;
      else if (this.cpu.opcode.addrSize === v)
        result = 0xFFFF + 1 + result;
    }

    this.flagSub(d, s, result);

    return result;
  }
  cmpsb (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  cmpsw (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  cs (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  cwd (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  daa (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }

  /**
   * DAS (Decimal Adjust for Subtraction) corrects the result of a previous
   * subtraction of two valid packed decimal operands (the destination operand
   * must have been specified as register AL). DAS changes the content of AL
   * to a pair of valid packed decimal digits. DAS updates AF, CF, PF, SF and
   * ZF; the content of OF is undefined following execution of DAS.
   *  - [1] p.2-36
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src Source addressing function
   * @return {number} Result of the operation
   */
  das (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }

  /**
   * DEC (Decrement) subtracts one from the destination, which may be a byte or
   * a word.
   *   - [1] p.2-36
   *
   * Modifies flags: AF, OF, PF, SF, and ZF
   *
   * NOTE: DEC does not affect CF.
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src Source addressing function
   * @return {number} Result of the operation
   */
  dec (dst, src) {
    let segment = this.cpu.reg16[regCS];
    let d = dst(segment, null);
    let s = 1;
    let result = d - s;

    // Handle underflow correctly
    if (result < 0) {
      if (this.cpu.opcode.addrSize === b)
        result = 0xFF + 1 + result;
      else if (this.cpu.opcode.addrSize === w)
        result = 0xFFFF + 1 + result;
      else if (this.cpu.opcode.addrSize === v)
        result = 0xFFFF + 1 + result;
    }

    this.flagSub(d, s, result);

    dst(segment, result);
    return result;
  }
  div (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  ds (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  es (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  hlt (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  idiv (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  imul (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  in (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  iin (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  inc (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  int (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  into (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  iret (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }

  /**
   * JA / JNBE - Jump if above / not below nor equal
   *
   * The conditional transfer instructions are jumps that may or may not
   * transfer control depending on the state of the CPU flags at the time the
   * instruction is executed. If the condition is "true," then control is
   * transferred to the target specified in the instruction. If the condition
   * is "false," then control passes to the instruction that follows the
   * conditional jump. All conditional jumps are SHORT, that is, the target
   * must be in the current code segment and within -128 to +127 bytes of the
   * first byte of the next instruction (JMP OOH jumps to the first byte of
   * the next instruction). Since the jump is made by adding the relative
   * displacement of the target to the instruction pointer, all conditional
   * jumps are self-relative and are appropriate for position-independent
   * routines.
   *
   * CONDITION TESTED: (CF OR ZF)=O
   *
   *   - [1] p.2-44 to 2.46
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src NOT USED
   * @return {boolean} True if the jump was made, false otherwise
   */
  ja (dst, src) {
    let segment = this.cpu.reg16[regCS];
    let offset = dst(segment);
    if ( (this.cpu.reg16[regFlags] & FLAG_ZF_MASK) === 0 ||
         (this.cpu.reg16[regFlags] & FLAG_CF_MASK) === 0)
    {
      this.cpu.reg16[regIP] = offset;
      return true;
    }
    else {
      return false;
    }
  }

  /**
   * JB / JNAE - Jump if below / not above nor equal
   *
   * The conditional transfer instructions are jumps that may or may not
   * transfer control depending on the state of the CPU flags at the time the
   * instruction is executed. If the condition is "true," then control is
   * transferred to the target specified in the instruction. If the condition
   * is "false," then control passes to the instruction that follows the
   * conditional jump. All conditional jumps are SHORT, that is, the target
   * must be in the current code segment and within -128 to +127 bytes of the
   * first byte of the next instruction (JMP OOH jumps to the first byte of
   * the next instruction). Since the jump is made by adding the relative
   * displacement of the target to the instruction pointer, all conditional
   * jumps are self-relative and are appropriate for position-independent
   * routines.
   *
   * CONDITION TESTED: CF=1
   *
   *   - [1] p.2-44 to 2.46
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src NOT USED
   * @return {boolean} True if the jump was made, false otherwise
   */
  jb (dst, src) {
    let segment = this.cpu.reg16[regCS];
    let offset = dst(segment);
    if ((this.cpu.reg16[regFlags] & FLAG_CF_MASK) > 0) {
      this.cpu.reg16[regIP] = offset;
      return true;
    }
    else {
      return false;
    }
  }

  /**
   * JBE / JNA - Jump if below or equal / not above
   *
   * The conditional transfer instructions are jumps that may or may not
   * transfer control depending on the state of the CPU flags at the time the
   * instruction is executed. If the condition is "true," then control is
   * transferred to the target specified in the instruction. If the condition
   * is "false," then control passes to the instruction that follows the
   * conditional jump. All conditional jumps are SHORT, that is, the target
   * must be in the current code segment and within -128 to +127 bytes of the
   * first byte of the next instruction (JMP OOH jumps to the first byte of
   * the next instruction). Since the jump is made by adding the relative
   * displacement of the target to the instruction pointer, all conditional
   * jumps are self-relative and are appropriate for position-independent
   * routines.
   *
   * CONDITION TESTED: (CF OR ZF)=1
   *
   *   - [1] p.2-44 to 2.46
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src NOT USED
   * @return {boolean} True if the jump was made, false otherwise
   */
  jbe (dst, src) {
    let segment = this.cpu.reg16[regCS];
    let offset = dst(segment);
    if ( (this.cpu.reg16[regFlags] & FLAG_ZF_MASK) > 0 ||
         (this.cpu.reg16[regFlags] & FLAG_CF_MASK) > 0)
    {
      this.cpu.reg16[regIP] = offset;
      return true;
    }
    else {
      return false;
    }
  }

  /**
   * JCXZ (Jump If CX Zero) transfers control to the target operand if CX is O.
   * This instruction is useful at the beginning of a loop to bypass the loop
   * if ex has a zero value, i.e., to execute the loop zero times.
   *
   * CONDITION TESTED: (CF OR ZF)=1
   *
   *   - [1] p.2-44 to 2.46
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src NOT USED
   * @return {boolean} True if the jump was made, false otherwise
   */
  jcxz (dst, src) {
    let segment = this.cpu.reg16[regCS];
    let offset = dst(segment);
    if ( this.cpu.reg16[regCX] === 0) {
      this.cpu.reg16[regIP] = offset;
      return true;
    }
    else {
      return false;
    }
  }

  /**
   * JG / JNLE - Jump if greater / not less nor equal
   *
   * The conditional transfer instructions are jumps that may or may not
   * transfer control depending on the state of the CPU flags at the time the
   * instruction is executed. If the condition is "true," then control is
   * transferred to the target specified in the instruction. If the condition
   * is "false," then control passes to the instruction that follows the
   * conditional jump. All conditional jumps are SHORT, that is, the target
   * must be in the current code segment and within -128 to +127 bytes of the
   * first byte of the next instruction (JMP OOH jumps to the first byte of
   * the next instruction). Since the jump is made by adding the relative
   * displacement of the target to the instruction pointer, all conditional
   * jumps are self-relative and are appropriate for position-independent
   * routines.
   *
   * CONDITION TESTED: ((SF XOR OF) OR ZF)=O
   *
   *   - [1] p.2-44 to 2.46
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src NOT USED
   * @return {boolean} True if the jump was made, false otherwise
   */
  jg (dst, src) {
    let segment = this.cpu.reg16[regCS];
    let offset = dst(segment);

    if (((this.cpu.reg16[regFlags] & FLAG_SF_MASK) >> 7) ^ ((this.cpu.reg16[regFlags] & FLAG_OF_MASK) >> 11) === 0 ||
         (this.cpu.reg16[regFlags] & FLAG_ZF_MASK) === 0)
    {
      this.cpu.reg16[regIP] = offset;
      return true;
    }
    else {
      return false;
    }
  }

  /**
   * JGE / JNL - Jump if greater or equal / not less
   *
   * The conditional transfer instructions are jumps that may or may not
   * transfer control depending on the state of the CPU flags at the time the
   * instruction is executed. If the condition is "true," then control is
   * transferred to the target specified in the instruction. If the condition
   * is "false," then control passes to the instruction that follows the
   * conditional jump. All conditional jumps are SHORT, that is, the target
   * must be in the current code segment and within -128 to +127 bytes of the
   * first byte of the next instruction (JMP OOH jumps to the first byte of
   * the next instruction). Since the jump is made by adding the relative
   * displacement of the target to the instruction pointer, all conditional
   * jumps are self-relative and are appropriate for position-independent
   * routines.
   *
   * CONDITION TESTED: (SF XOR OF)=O
   *
   *   - [1] p.2-44 to 2.46
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src NOT USED
   * @return {boolean} True if the jump was made, false otherwise
   */
  jge (dst, src) {
    let segment = this.cpu.reg16[regCS];
    let offset = dst(segment);

    if (((this.cpu.reg16[regFlags] & FLAG_SF_MASK) >> 7) ^
        ((this.cpu.reg16[regFlags] & FLAG_OF_MASK) >> 11) === 0)
    {
      this.cpu.reg16[regIP] = offset;
      return true;
    }
    else {
      return false;
    }
  }

  /**
   * JL / JNGE - Jump if less / not greater nor equal
   *
   * The conditional transfer instructions are jumps that may or may not
   * transfer control depending on the state of the CPU flags at the time the
   * instruction is executed. If the condition is "true," then control is
   * transferred to the target specified in the instruction. If the condition
   * is "false," then control passes to the instruction that follows the
   * conditional jump. All conditional jumps are SHORT, that is, the target
   * must be in the current code segment and within -128 to +127 bytes of the
   * first byte of the next instruction (JMP OOH jumps to the first byte of
   * the next instruction). Since the jump is made by adding the relative
   * displacement of the target to the instruction pointer, all conditional
   * jumps are self-relative and are appropriate for position-independent
   * routines.
   *
   * CONDITION TESTED: (SF XOR OF)=1
   *
   *   - [1] p.2-44 to 2.46
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src NOT USED
   * @return {boolean} True if the jump was made, false otherwise
   */
  jl (dst, src) {
    let segment = this.cpu.reg16[regCS];
    let offset = dst(segment);

    if (((this.cpu.reg16[regFlags] & FLAG_SF_MASK) >> 7) ^
        ((this.cpu.reg16[regFlags] & FLAG_OF_MASK) >> 11) === 1)
    {
      this.cpu.reg16[regIP] = offset;
      return true;
    }
    else {
      return false;
    }
  }

  /**
   * JLE / JNG - Jump if less or equal / not greater
   *
   * The conditional transfer instructions are jumps that may or may not
   * transfer control depending on the state of the CPU flags at the time the
   * instruction is executed. If the condition is "true," then control is
   * transferred to the target specified in the instruction. If the condition
   * is "false," then control passes to the instruction that follows the
   * conditional jump. All conditional jumps are SHORT, that is, the target
   * must be in the current code segment and within -128 to +127 bytes of the
   * first byte of the next instruction (JMP OOH jumps to the first byte of
   * the next instruction). Since the jump is made by adding the relative
   * displacement of the target to the instruction pointer, all conditional
   * jumps are self-relative and are appropriate for position-independent
   * routines.
   *
   * CONDITION TESTED: ((SF XOR OF) OR ZF)=1
   *
   *   - [1] p.2-44 to 2.46
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src NOT USED
   * @return {boolean} True if the jump was made, false otherwise
   */
  jle (dst, src) {
    let segment = this.cpu.reg16[regCS];
    let offset = dst(segment);

    if (((this.cpu.reg16[regFlags] & FLAG_SF_MASK) >> 7) ^ ((this.cpu.reg16[regFlags] & FLAG_OF_MASK) >> 11) > 0 ||
        (this.cpu.reg16[regFlags] & FLAG_ZF_MASK) > 0)
    {
      this.cpu.reg16[regIP] = offset;
      return true;
    }
    else {
      return false;
    }
  }

  /**
   * JMP unconditionally transfers control to the target location. Unlike a CALL
   * instruction, JMP does not save any information on the stack, and no return to
   * the instruction following the JMP is expected. Like CALL, the address of the
   * target operand may be obtained from the instruction itself (direct JMP) or
   * from memory or a register referenced by the instruction (indirect JMP).
   *
   * An intrasegment direct JMP changes the instruction pointer by adding the
   * relative displacement of the target from the JMP instruction. If the assembler
   * can determine that the target is within 127 bytes of the JMP, it automatically
   * generates a two-byte form of this instruction called a SHORT JMP; otherwise,
   * it generates a NEAR JMP that can address a target within ±32k. Intrasegment
   * direct JMPS are self-relative and are appropriate in position-independent
   * (dynamically relocatable) routines in which the JMP and its target are in the
   * same segment and are moved together.
   *
   * An intrasegment indirect JMP may be made either through memory or through a
   * 16-bit general register. In the first case, the content of the word referenced
   * by the instruction replaces the instruction pointer. In the second case, the
   * new IP value is taken from the register named in the instruction.
   *
   * An intersegment direct JMP replaces IP and CS with values contained in the
   * instruction.
   *
   * An intersegment indirect JMP may be made only through memory. The first
   * word of the doubleword pointer referenced by the instruction replaces IP,
   * and the second word replaces CS.
   *   - [1] p.2-45
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src NOT USED
   * @return {boolean} True
   */
  jmp (dst, src) {
    let segment = this.cpu.reg16[regCS];
    let oper = dst(segment);

    switch (this.cpu.opcode.opcode_byte) {
      case 0xE9: // JMP Jv (near)
        this.cpu.reg16[regIP] = oper;
        break;
      case 0xEA: // JMP Ap (far)
        this.cpu.reg16[regCS] = oper[0];
        this.cpu.reg16[regIP] = oper[1];
        break;
      case 0xEB: // JMP Jb (short)
        this.cpu.reg16[regIP] = oper;
        break;
      case 0xFF:
        if (this.cpu.opcode.reg === 4) { // JMP Ev (near)
          this.cpu.reg16[regIP] = oper;
        }
        else if (this.cpu.opcode.reg === 5) { // JMP Mp (far)
          this.cpu.reg16[regCS] = oper[0];
          this.cpu.reg16[regIP] = oper[1];
        }
        break;
    }
    return true;
  }

  /**
   * JAE / JNB Jump if above or equal / not below
   *
   * The conditional transfer instructions are jumps that may or may not
   * transfer control depending on the state of the CPU flags at the time the
   * instruction is executed. If the condition is "true," then control is
   * transferred to the target specified in the instruction. If the condition
   * is "false," then control passes to the instruction that follows the
   * conditional jump. All conditional jumps are SHORT, that is, the target
   * must be in the current code segment and within -128 to +127 bytes of the
   * first byte of the next instruction (JMP OOH jumps to the first byte of
   * the next instruction). Since the jump is made by adding the relative
   * displacement of the target to the instruction pointer, all conditional
   * jumps are self-relative and are appropriate for position-independent
   * routines.
   *
   * CONDITION TESTED: CF=O
   *
   *   - [1] p.2-44 to 2.46
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src NOT USED
   * @return {boolean} True if the jump was made, false otherwise
   */
  jnb (dst, src) {
    let segment = this.cpu.reg16[regCS];
    let offset = dst(segment);
    if ((this.cpu.reg16[regFlags] & FLAG_CF_MASK) === 0) {
      this.cpu.reg16[regIP] = offset;
      return true;
    }
    else {
      return false;
    }
  }

  /**
   * JNO Jump if not overflow
   *
   * The conditional transfer instructions are jumps that may or may not
   * transfer control depending on the state of the CPU flags at the time the
   * instruction is executed. If the condition is "true," then control is
   * transferred to the target specified in the instruction. If the condition
   * is "false," then control passes to the instruction that follows the
   * conditional jump. All conditional jumps are SHORT, that is, the target
   * must be in the current code segment and within -128 to +127 bytes of the
   * first byte of the next instruction (JMP OOH jumps to the first byte of
   * the next instruction). Since the jump is made by adding the relative
   * displacement of the target to the instruction pointer, all conditional
   * jumps are self-relative and are appropriate for position-independent
   * routines.
   *
   * CONDITION TESTED: OF=O
   *
   *   - [1] p.2-44 to 2.46
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src NOT USED
   * @return {boolean} True if the jump was made, false otherwise
   */
  jno (dst, src) {
    let segment = this.cpu.reg16[regCS];
    let offset = dst(segment);
    if ((this.cpu.reg16[regFlags] & FLAG_OF_MASK) === 0) {
      this.cpu.reg16[regIP] = offset;
      return true;
    }
    else {
      return false;
    }
  }

  /**
   * JNS Jump if not sign
   *
   * The conditional transfer instructions are jumps that may or may not
   * transfer control depending on the state of the CPU flags at the time the
   * instruction is executed. If the condition is "true," then control is
   * transferred to the target specified in the instruction. If the condition
   * is "false," then control passes to the instruction that follows the
   * conditional jump. All conditional jumps are SHORT, that is, the target
   * must be in the current code segment and within -128 to +127 bytes of the
   * first byte of the next instruction (JMP OOH jumps to the first byte of
   * the next instruction). Since the jump is made by adding the relative
   * displacement of the target to the instruction pointer, all conditional
   * jumps are self-relative and are appropriate for position-independent
   * routines.
   *
   * CONDITION TESTED: SF=O
   *
   *   - [1] p.2-44 to 2.46
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src NOT USED
   * @return {boolean} True if the jump was made, false otherwise
   */
  jns (dst, src) {
    let segment = this.cpu.reg16[regCS];
    let offset = dst(segment);
    if ((this.cpu.reg16[regFlags] & FLAG_SF_MASK) === 0) {
      this.cpu.reg16[regIP] = offset;
      return true;
    }
    else {
      return false;
    }
  }

  /**
   * JNE / JNZ Jump if not equal / not zero
   *
   * The conditional transfer instructions are jumps that may or may not
   * transfer control depending on the state of the CPU flags at the time the
   * instruction is executed. If the condition is "true," then control is
   * transferred to the target specified in the instruction. If the condition
   * is "false," then control passes to the instruction that follows the
   * conditional jump. All conditional jumps are SHORT, that is, the target
   * must be in the current code segment and within -128 to +127 bytes of the
   * first byte of the next instruction (JMP OOH jumps to the first byte of
   * the next instruction). Since the jump is made by adding the relative
   * displacement of the target to the instruction pointer, all conditional
   * jumps are self-relative and are appropriate for position-independent
   * routines.
   *
   * CONDITION TESTED: ZF=O
   *
   *   - [1] p.2-44 to 2.46
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src NOT USED
   * @return {boolean} True if the jump was made, false otherwise
   */
  jnz (dst, src) {
    let segment = this.cpu.reg16[regCS];
    let offset = dst(segment);
    if ((this.cpu.reg16[regFlags] & FLAG_ZF_MASK) === 0) {
      this.cpu.reg16[regIP] = offset;
      return true;
    }
    else {
      return false;
    }
  }

  /**
   * JO Jump if overflow
   *
   * The conditional transfer instructions are jumps that may or may not
   * transfer control depending on the state of the CPU flags at the time the
   * instruction is executed. If the condition is "true," then control is
   * transferred to the target specified in the instruction. If the condition
   * is "false," then control passes to the instruction that follows the
   * conditional jump. All conditional jumps are SHORT, that is, the target
   * must be in the current code segment and within -128 to +127 bytes of the
   * first byte of the next instruction (JMP OOH jumps to the first byte of
   * the next instruction). Since the jump is made by adding the relative
   * displacement of the target to the instruction pointer, all conditional
   * jumps are self-relative and are appropriate for position-independent
   * routines.
   *
   * CONDITION TESTED: OF=1
   *
   *   - [1] p.2-44 to 2.46
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src NOT USED
   * @return {boolean} True if the jump was made, false otherwise
   */
  jo (dst, src) {
    let segment = this.cpu.reg16[regCS];
    let offset = dst(segment);
    if ((this.cpu.reg16[regFlags] & FLAG_OF_MASK) > 0) {
      this.cpu.reg16[regIP] = offset;
      return true;
    }
    else {
      return false;
    }
  }

  /**
   * JP / JPE Jump if parity / parity even
   *
   * The conditional transfer instructions are jumps that may or may not
   * transfer control depending on the state of the CPU flags at the time the
   * instruction is executed. If the condition is "true," then control is
   * transferred to the target specified in the instruction. If the condition
   * is "false," then control passes to the instruction that follows the
   * conditional jump. All conditional jumps are SHORT, that is, the target
   * must be in the current code segment and within -128 to +127 bytes of the
   * first byte of the next instruction (JMP OOH jumps to the first byte of
   * the next instruction). Since the jump is made by adding the relative
   * displacement of the target to the instruction pointer, all conditional
   * jumps are self-relative and are appropriate for position-independent
   * routines.
   *
   * CONDITION TESTED: PF=1
   *
   *   - [1] p.2-44 to 2.46
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src NOT USED
   * @return {boolean} True if the jump was made, false otherwise
   */
  jpe (dst, src) {
    let segment = this.cpu.reg16[regCS];
    let offset = dst(segment);
    if ((this.cpu.reg16[regFlags] & FLAG_PF_MASK) > 0) {
      this.cpu.reg16[regIP] = offset;
      return true;
    }
    else {
      return false;
    }
  }

  /**
   * JNP / JPO Jump if not parity / parity odd
   *
   * The conditional transfer instructions are jumps that may or may not
   * transfer control depending on the state of the CPU flags at the time the
   * instruction is executed. If the condition is "true," then control is
   * transferred to the target specified in the instruction. If the condition
   * is "false," then control passes to the instruction that follows the
   * conditional jump. All conditional jumps are SHORT, that is, the target
   * must be in the current code segment and within -128 to +127 bytes of the
   * first byte of the next instruction (JMP OOH jumps to the first byte of
   * the next instruction). Since the jump is made by adding the relative
   * displacement of the target to the instruction pointer, all conditional
   * jumps are self-relative and are appropriate for position-independent
   * routines.
   *
   * CONDITION TESTED: PF=O
   *
   *   - [1] p.2-44 to 2.46
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src NOT USED
   * @return {boolean} True if the jump was made, false otherwise
   */
  jpo (dst, src) {
    let segment = this.cpu.reg16[regCS];
    let offset = dst(segment);
    if ((this.cpu.reg16[regFlags] & FLAG_PF_MASK) === 0) {
      this.cpu.reg16[regIP] = offset;
      return true;
    }
    else {
      return false;
    }
  }

  /**
   * JS Jump if sign
   *
   * The conditional transfer instructions are jumps that may or may not
   * transfer control depending on the state of the CPU flags at the time the
   * instruction is executed. If the condition is "true," then control is
   * transferred to the target specified in the instruction. If the condition
   * is "false," then control passes to the instruction that follows the
   * conditional jump. All conditional jumps are SHORT, that is, the target
   * must be in the current code segment and within -128 to +127 bytes of the
   * first byte of the next instruction (JMP OOH jumps to the first byte of
   * the next instruction). Since the jump is made by adding the relative
   * displacement of the target to the instruction pointer, all conditional
   * jumps are self-relative and are appropriate for position-independent
   * routines.
   *
   * CONDITION TESTED: SF=1
   *
   *   - [1] p.2-44 to 2.46
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src NOT USED
   * @return {boolean} True if the jump was made, false otherwise
   */
  js (dst, src) {
    let segment = this.cpu.reg16[regCS];
    let offset = dst(segment);
    if ((this.cpu.reg16[regFlags] & FLAG_SF_MASK) > 0) {
      this.cpu.reg16[regIP] = offset;
      return true;
    }
    else {
      return false;
    }
  }

  /**
   * JZ / JE - Jump if equal/zero
   *
   * The conditional transfer instructions are jumps that may or may not
   * transfer control depending on the state of the CPU flags at the time the
   * instruction is executed. If the condition is "true," then control is
   * transferred to the target specified in the instruction. If the condition
   * is "false," then control passes to the instruction that follows the
   * conditional jump. All conditional jumps are SHORT, that is, the target
   * must be in the current code segment and within -128 to +127 bytes of the
   * first byte of the next instruction (JMP OOH jumps to the first byte of
   * the next instruction). Since the jump is made by adding the relative
   * displacement of the target to the instruction pointer, all conditional
   * jumps are self-relative and are appropriate for position-independent
   * routines.
   *
   * CONDITION TESTED: ZF=O
   *
   *   - [1] p.2-44 to 2.46
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src Source addressing function
   * @return {boolean} True if the jump was made, false otherwise
   */
  jz (dst, src) {
    let segment = this.cpu.reg16[regCS];
    let offset = dst(segment);
    if ((this.cpu.reg16[regFlags] & FLAG_ZF_MASK) > 0) {
      this.cpu.reg16[regIP] = offset;
      return true;
    }
    else {
      return false;
    }
  }

  /**
   * LAHF (load register AH from flags) copies SF, ZF, AF, PF and CF (the
   * 8080/8085 flags) into bits 7, 6, 4, 2 and 0, respectively, of register
   * AH (see figure 2-32). The content of bits 5, 3 and 1 is undefined; the
   * flags themselves are not affected. LAHF is provided primarily for
   * converting 8080/8085 assembly language programs to run on an 8086 or 8088.
   *   - [1] p.2-32
   *
   * AH ← EFLAGS(SF:ZF:0:AF:0:PF:1:CF);
   *   - [4] 3-518
   *
   * @param {Function} dst NOT USED
   * @param {Function} src NOT USED
   */
  lahf (dst, src) {
    this.cpu.reg8[regAH] = this.cpu.reg16[regFlags] & 0b11010111;
  }

  /**
   * LDS (load pointer using DS) transfers a 32-bit pointer variable from the
   * source operand, which must be a memory operand, to the destination operand
   * and register DS. The offset word of the pointer is transferred to the
   * destination operand, which may be any 16-bit general register. The segment
   * word of the pointer is transferred to register DS. Specifying SI as the
   * destination operand is a convenient way to prepare to process a source
   * string that is not in the current data segment (string instructions assume
   * that the source string is located in the current data segment and that SI
   * contains the offset of the string).
   *   - [1] p.2-32
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src Source addressing function
   */
  lds (dst, src) {
    let segment = this.cpu.reg16[this.cpu.addrSeg];
    let srcVal = src(segment);
    dst(segment, srcVal[1]);
    this.cpu.reg16[regDS] = srcVal[0];
  }

  /**
   * LEA (load effective address) transfers the offset of the source operand
   * (rather than its value) to the destination operand. The source operand
   * must be a memory operand, and the destination operand must be a 16-bit
   * general register. LEA does not affect any flags. The XLA T and string
   * instructions assume that certain registers point to operands; LEA can
   * be used to load these registers (e.g., 10'lding BX with the address of
   * the translate table used by the XLA T instruction).
   *   - [1] p.2-45
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src Source addressing function
   */
  lea (dst, src) {
    let segment = this.cpu.reg16[this.cpu.addrSeg];
    let srcVal = src(segment);
    return dst(segment, srcVal);
  }

  /**
   * LES (load pointer using ES) transfers a 32-bit pointer variable from the
   * source operand, which must be a memory operand, to the destination operand
   * and register ES. The offset word of the pointer is transferred to the
   * destination operand, which may be any 16-bit general register. The segment
   * word of the pointer is transferred to register ES. Specifying DI as the
   * destination operand is a convenient way to prepare to process a
   * destination string that is not in the current extra segment. (The
   * destination string must be located in the extra segment, and DI must
   * contain the offset of the string.)
   *   - [1] p.2-32
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src Source addressing function
   */
  les (dst, src) {
    let segment = this.cpu.reg16[this.cpu.addrSeg];
    let srcVal = src(segment);
    dst(segment, srcVal[1]);
    this.cpu.reg16[regES] = srcVal[0];
  }

  lock (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  lodsb (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  lodsw (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }

  /**
   * LOOPNE and LOOPNZ (Loop While Not Equal and Loop While Not Zero) are also
   * synonyms for the same instruction. CX is decremented by 1, and control is
   * transferred to the target operand if CX is not 0 and if ZF is clear;
   * otherwise the next sequential instruction is executed.
   *   - [1] p.2-45
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src Source addressing function
   * @return {boolean} True if the jump was made, false otherwise
   */
  loopnz (dst, src) {
    this.cpu.reg16[regCX] -= 1;

    let segment = this.cpu.reg16[regCS];
    let operand = dst(segment);

    if (this.cpu.reg16[regCX] !== 0 &&
      ((this.cpu.reg16[regFlags] & FLAG_ZF_MASK) === 0))
    {
      this.cpu.reg16[regIP] = operand;
      return true;
    }
    return false;
  }

  /**
   * LOOPE and LOOPZ (Loop While Equal and Loop While Zero) are different
   * mnemonics for the same instruction (similar to the REPE and REPZ repeat
   * prefixes). CX is decremented by 1, and control is transferred to the
   * target operand if CX is not 0 and if ZF is set; otherwise the instruction
   * following LOOPE/LOOPZ is executed.
   *   - [1] p.2-45
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src Source addressing function
   * @return {boolean} True if the jump was made, false otherwise
   */
  loopz (dst, src) {
    this.cpu.reg16[regCX] -= 1;

    let segment = this.cpu.reg16[regCS];
    let operand = dst(segment);

    if (this.cpu.reg16[regCX] !== 0 &&
      ((this.cpu.reg16[regFlags] & FLAG_ZF_MASK) > 0))
    {
      this.cpu.reg16[regIP] = operand;
      return true;
    }
    return false;
  }

  /**
   * LOOP decrements CX by 1 and transfers control to the target operand if CX
   * is not 0; otherwise the instruction following LOOP is executed.
   *   - [1] p.2-45
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src Source addressing function
   * @return {boolean} True if the jump was made, false otherwise
   */
  loop (dst, src) {
    this.cpu.reg16[regCX] -= 1;

    let segment = this.cpu.reg16[regCS];
    let operand = dst(segment);

    if (this.cpu.reg16[regCX] !== 0) {
      this.cpu.reg16[regIP] = operand;
      return true;
    }
    return false;
  }

  /**
   * MOV transfers a byte or a word from the source operand to the destination
   * operand.
   *  - [1] p.2-31
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src Source addressing function
   * @return {number} Result of the operation
   */
  mov (dst, src) {
    let segment = this.cpu.reg16[this.cpu.addrSeg];
    let srcVal = src(segment);
    return dst(segment, srcVal);
  }

  movb (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  movsb (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  movsw (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  mul (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }

  /**
   * NEG (Negate) subtracts the destination operand, which may be a byte or a
   * word, from 0 and returns the result to the destination. This forms the
   * two's complement of the number, effectively reversing the sign of an
   * integer. If the operand is zero, its sign is not changed. Attempting to
   * negate a byte containing -128 or a word containing -32,768 causes no
   * change to the operand and sets OF.
   *  - [1] p.2-36
   *
   * Modifies flags: AF, CF, OF, PF, SF and ZF. CF is always set except when
   * the operand is zero, in which case it is cleared.
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src Source addressing function
   * @return {number} Result of the operation
   */
  neg (dst, src) {
    let segment = this.cpu.reg16[regCS];
    let d = dst(segment, null);
    let result = 0 - d;

    // Handle underflow correctly
    if (result < 0) {
      if (this.cpu.opcode.addrSize === b)
        result = 0xFF + 1 + result;
      else if (this.cpu.opcode.addrSize === w)
        result = 0xFFFF + 1 + result;
      else if (this.cpu.opcode.addrSize === v)
        result = 0xFFFF + 1 + result;
    }

    this.flagSub(0, d, result);

    if (this.cpu.opcode.addrSize === b && d === 0x80) {
      result = 0x80;
      this.cpu.reg16[regFlags] |= FLAG_OF_MASK;
    }
    else if (d === 0x8000) {
      result = 0x8000;
      this.cpu.reg16[regFlags] |= FLAG_OF_MASK;
    }

    dst(segment, result);
    return result;
  }

  nop (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  not (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  or (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  out (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }

  /**
   * POP transfers the word at the current top of stack (pointed to by SP) to
   * the destination operand, and then increments SP by two to point to the new
   * top of stack. POP can be used to move temporary variables from the stack
   * to registers or memory.
   *   - [1] p.2-31
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src Source addressing function
   */
  pop (dst, src) {
    let segment = this.cpu.reg16[regCS];
    dst(segment, this.pop16());
  }

  /**
   * POPF transfers specific bits from the word at the current top of stack
   * (pointed to by register SP) into the 8086/8088 flags, replacing whatever
   * values the flags previously contained (see figure 2-32). SP is then
   * incremented by two to point to the new top of stack. PUSHF and POPF allow
   * a procedure to save and restore a calling program's flags. They also
   * allow a program to change the setting of TF (there is no instruction for
   * updating this flag directly). The change is accomplished by pushing the
   * flags, altering bit 8 of the memory-image and then popping the flags.
   *   - [1] p.2-31
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src Source addressing function
   */
  popf (dst, src) {
    this.cpu.reg16[regFlags] = this.pop16();
  }

  /**
   * PUSH decrements SP (the stack pointer) by two and then transfers a word
   * from the source operand to the top of stack now pointed to by SP. PUSH
   * often is used to place parameters on the stack before calling a procedure;
   * more generally, it is the basic means of storing temporary data on the
   * stack.
   *   - [1] p.2-31
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src Source addressing function
   */
  push (dst, src) {
    let segment = this.cpu.reg16[regCS];
    this.push16(dst(segment));
  }

  /**
   * PUSHF decrements SP (the stack pointer) by two and then transfers all
   * flags to the word at the top of stack pointed to by SP (see figure 2-32).
   * The flags themselves are not affected.
   *    - [1] p.2-33
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src Source addressing function
   */
  pushf (dst, src) {
    this.push16(this.cpu.reg16[regFlags]);
  }

  rcl (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  rcr (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  repnz (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  repz (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }

  /**
   * RET (Return) transfers control from a procedure back to the instruction
   * following the CALL that activated the procedure. RET pops the word at the
   * top of the stack (pointed to by register SP) into the instruction pointer
   * and increments SP by two. If an optional pop value has been specified, RET
   * adds that value to SP. This feature may be used to discard parameters
   * pushed onto the stack before the execution of the CALL instruction.
   *   - [1] p.2-45
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src Source addressing function
   */
  ret (dst, src) {
    switch (this.cpu.opcode.opcode_byte) {
      case 0xC2: // RET Iw
        let segment = this.cpu.reg16[regCS];
        this.cpu.reg16[regIP] = this.pop16() + dst(segment);
        break;
      case 0xC3: // RET
        this.cpu.reg16[regIP] = this.pop16();
        break;
    }
  }

  /**
   * RET (Return) transfers control from a procedure back to the instruction
   * following the CALL that activated the procedure. RETF pops the word at the
   * top of the stack (pointed to by register SP) into the instruction pointer
   * and increments SP by two. Then the word at the new top of stack is popped
   * into the CS register, and SP is again incremented by two. If an optional
   * pop value has been specified, RET adds that value to SP. This feature may
   * be used to discard parameters pushed onto the stack before the execution
   * of the CALL instruction.
   *   - [1] p.2-45
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src Source addressing function
   */
  retf (dst, src) {
    switch (this.cpu.opcode.opcode_byte) {
      case 0xCA: // RETF Iw
        let segment = this.cpu.reg16[regCS];

        this.cpu.reg16[regIP] = this.pop16() + dst(segment);
        this.cpu.reg16[regCS] = this.pop16();
        break;
      case 0xCB: // RETF
        this.cpu.reg16[regIP] = this.pop16();
        this.cpu.reg16[regCS] = this.pop16();
        break;
    }
  }

  rol (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  ror (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }

  /**
   * SAHF (store register AH into flags) transfers bits 7,6,4,2 and 0 from
   * register AH into SF, ZF, AF, PF and CF, respectively, replacing whatever
   * values these flags previously had. OF, DF, IF and TF are not affected.
   * This instruction is provided for 8080/8085 compatibility.
   *   - [1] p.2-33
   *
   * @param {Function} dst NOT USED
   * @param {Function} src NOT USED
   */
  sahf (dst, src) {

    this.cpu.reg16[regFlags] |= (this.cpu.reg8[regAH] & 0b11010111);
  }

  sar (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }

  /**
   * SBB (Subtract with Borrow) subtracts the source from the destination,
   * subtracts one if CF is set, and returns the result to the destination
   * operand. Both operands may be bytes or words. Both operands may be signed
   * or unsigned binary numbers (see AAS and DAS). Since it incorporates a
   * borrow from a previous operation, SBB may be used to write routines that
   * subtract numbers longer than 16 bits.
   *   - [1] p.2-36
   *
   * Modifies flags: AF CF OF PF SF ZF
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src Source addressing function
   * @return {number} Result of the operation
   */
  sbb (dst, src) {
    let segment = this.cpu.reg16[regCS];
    let d = dst(segment, null);
    let s = src(segment, null);
    if (this.cpu.opcode.addrSize === w || this.cpu.opcode.addrSize === v) {
      s = signExtend(s);
    }
    let result = d - s - (this.cpu.reg16[regFlags] & FLAG_CF_MASK);

    // Handle underflow correctly
    if (result < 0) {
      if (this.cpu.opcode.addrSize === b)
        result = 0xFF + 1 + result;
      else if (this.cpu.opcode.addrSize === w)
        result = 0xFFFF + 1 + result;
      else if (this.cpu.opcode.addrSize === v)
        result = 0xFFFF + 1 + result;
    }

    this.flagSub(d, s, result);

    dst(segment, result);
    return result;
  }

  scasb (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  scasw (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  shl (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  shr (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  ss (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  stc (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  std (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  sti (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  stosb (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  stosw (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }

  /**
   * SUB The source operand is ~ubtracted from the destination operand, and
   * the result replaces the destination operand. The operands may be bytes or
   * words. Both operands may be signed or unsigned binary numbers (see AAS
   * and DAS).
   *   - [1] p.2-36
   *
   * Modifies flags: AF CF OF PF SF ZF
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src Source addressing function
   * @return {number} Result of the operation
   */
  sub (dst, src) {
    let segment = this.cpu.reg16[regCS];
    let d = dst(segment, null);
    let s = src(segment, null);
    if (this.cpu.opcode.addrSize === w || this.cpu.opcode.addrSize === v) {
      s = signExtend(s);
    }
    let result = d - s;

    // Handle underflow correctly
    if (result < 0) {
      if (this.cpu.opcode.addrSize === b)
        result = 0xFF + 1 + result;
      else if (this.cpu.opcode.addrSize === w)
        result = 0xFFFF + 1 + result;
      else if (this.cpu.opcode.addrSize === v)
        result = 0xFFFF + 1 + result;
    }

    this.flagSub(d, s, result);

    dst(segment, result);
    return result;
  }

  test (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  wait (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }

  /**
   * XCHG (exchange) switches the contents of the source and destination (byte
   * or word) operands. When used in conjunction with the LOCK prefix, XCHG
   * can test and set a semaphore that controls access to a resource shared by
   * multiple processors (see section 2.5).
   *   - [1] p.2-36
   *
   * @param {Function} dst Destination addressing function
   * @param {Function} src Source addressing function
   * @return {number}
   */
  xchg (dst, src) {
    let segment = this.cpu.reg16[this.cpu.addrSeg];
    let srcVal = src(segment);
    src(segment, dst(segment));
    dst(segment, srcVal);
  }

  xlat (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }
  xor (dst, src) {
    throw new FeatureNotImplementedException("Operation not implemented");
  }

  notimp () {
    winston.log("info", "Operations - Instruction not implemented");
  };

  /**
   * Push a value onto the stack. SP is decremented by two and the value is
   * stored at regSS:regSP
   *
   * @param {number} value Word value to push onto the stack
   */
  push16 (value) {
    // Update stack pointer
    this.cpu.reg16[regSP] -= 2;

    this.cpu.mem8[seg2abs(this.cpu.reg16[regSS], this.cpu.reg16[regSP], this.cpu)]     = (value & 0x00FF);
    this.cpu.mem8[seg2abs(this.cpu.reg16[regSS], this.cpu.reg16[regSP] + 1, this.cpu)] = (value >> 8);
  }

  /**
   * Pop a value off the stack. SP is incremented by two and the value at
   * regSS:regSP is returned.
   *
   * @return {number} Word value popped off the stack
   */
  pop16 () {
    // Get the value from the stack
    let value = this.cpu.mem8[seg2abs(this.cpu.reg16[regSS], this.cpu.reg16[regSP] + 1, this.cpu)] << 8 |
                this.cpu.mem8[seg2abs(this.cpu.reg16[regSS], this.cpu.reg16[regSP], this.cpu)];

    this.cpu.reg16[regSP] += 2;

    return value;
  }

  // https://en.wikipedia.org/wiki/FLAGS_register

  /**
   * PF (parity flag): If the low-order eight bits of an arithmetic or logical
   * result contain an even number of I-bits, then the parity flag is set;
   * otherwise it is cleared. PF is provided for 8080/8085 compatibility; it
   * also can be used to check ASCII characters for correct parity.
   *   - [1] p.2-35
   *
   * @param {number} result Result of the operation to set the flag for
   */
  setPF_FLAG (result) {
    if (PARITY[(result & 0x00FF)]) this.cpu.reg16[regFlags] |= FLAG_PF_MASK;
    else this.cpu.reg16[regFlags] &= ~FLAG_PF_MASK;

    // let bitRep = (result & 0x00FF).toString(2);
    // let bitCnt = 0;
    // for (let b in bitRep) { if ("1" === bitRep[b]) bitCnt++; }
    //
    // if (0 === (bitCnt % 2)) this.cpu.reg16[regFlags] |= FLAG_PF_MASK;
    // else this.cpu.reg16[regFlags] &= ~FLAG_PF_MASK;
  }

  /**
   * SF (sign flag): Arithmetic and logical instructions set the sign flag
   * equal to the high-order bit (bit 7 or 15) of the result. For signed binary
   * numbers, the sign flag will be a for positive results and 1 for negative
   * results (so long as overflow does not occur). A conditional jump
   * instruction can be used following addition or subtraction to alter the
   * flow of the program depending on the sign of the result. Programs
   * performing unsigned operations typically ignore SF since the high-order
   * bit of the result is interpreted as a digit rather than a sign.
   *   - [1] p.2-35
   *
   * @param {number} result Result of the operation to set the flag for
   * @param {boolean} twosComplement Is the result a twos complement value?
   */
  setSF_FLAG (result, twosComplement=true) {
    if (twosComplement) {
      let size = this.cpu.opcode.addrSize;
      if (b === size && (result & 0xFF) >> 7) this.cpu.reg16[regFlags] |= FLAG_SF_MASK;
      else if ((result & 0xFFFF) >> 15) this.cpu.reg16[regFlags] |= FLAG_SF_MASK;
      else this.cpu.reg16[regFlags] &= ~FLAG_SF_MASK;
    }
    else {
      if (result < 0) this.cpu.reg16[regFlags] |= FLAG_SF_MASK;
      else this.cpu.reg16[regFlags] &= ~FLAG_SF_MASK;
    }
  }

  /**
   * ZF (zero flag): If the result of an arithmetic or logical operation is
   * zero, then ZF is set; otherwise ZF is cleared. A conditional jump
   * instruction can be used to alter the flow of the program if the result is
   * or is not zero.
   *   - [1] p.2-35
   *
   * @param {number} result Result of the operation to set the flag for
   */
  setZF_FLAG (result) {
    if (0 === result) this.cpu.reg16[regFlags] |= FLAG_ZF_MASK;
    else this.cpu.reg16[regFlags] &= ~FLAG_ZF_MASK;
  }

  /**
   *
   * @param v1
   * @param v2
   * @param result
   */
  flagSub (v1, v2, result) {
    let size = this.cpu.opcode.addrSize;
    // let result = v1 - v2;

    // CF (carry flag): If an addition results in a carry out of the high-order
    // bit of the result, then CF is set; otherwise CF is cleared. If a
    // subtraction results in a borrow into the highorder bit of the result,
    // then CF is set; otherwise CF is cleared. Note that a signed carry is
    // indicated by CF ≠ OF. CF can be used to detect an unsigned overflow.
    // Two instructions, ADC (add with carry) and SBB (subtract with borrow),
    // incorporate the carry flag  in their operations and can be used to
    // perform multibyte (e.g., 32-bit, 64-bit) addition and subtraction.
    //   - [1] p.2-35
    if ((v1 - v2) & (size === b ? 0xFF00 : 0xFFFF0000)) {
      this.cpu.reg16[regFlags] |= FLAG_CF_MASK
    } else {
      this.cpu.reg16[regFlags] &= ~FLAG_CF_MASK
    }

    // OF (overflow flag): If the result of an operation is too large a
    // positive number, or too small a negative number to fit in the
    // destination operand (excluding the sign bit), then OF is set; otherwise
    // OF is cleared. OF thus indicates signed arithmetic overflow; it can be
    // tested with a conditional jump or the INTO (interrupt on overflow)
    // instruction. OF may be ignored when performing unsigned arithmetic.
    //   - [1] p.2-35
    if ( (result ^ v1) & (v1 ^ v2) & (size === b ? 0x80 : 0x8000)) {
      this.cpu.reg16[regFlags] |= FLAG_OF_MASK;
    } else {
      this.cpu.reg16[regFlags] &= ~FLAG_OF_MASK;
    }
    // For addition
    // if ( (result ^ v1) & (result ^ v2) & (size === b ? 0x80 : 0x8000)) {
    //   this.cpu.reg16[regFlags] |= FLAG_OF_MASK;
    // } else {
    //   this.cpu.reg16[regFlags] &= ~FLAG_OF_MASK;
    // }

    // AF (auxiliary carry flag): If an addition results in a carry out of the
    // low-order halfbyte of the result, then AF is set; otherwise AF is
    // cleared. If a subtraction results in a borrow into the low-order
    // half-byte of the result, then AF is set; otherwise AF is cleared. The
    // auxiliary carry flag is provided for the decimal adjust instructions and
    // ordinarily is not used for any other purpose.
    //   - [1] p.2-35
    if ( (v1 ^ v2 ^ result) & 0x10) {
      this.cpu.reg16[regFlags] |= FLAG_AF_MASK;
    } else {
      this.cpu.reg16[regFlags] &= ~FLAG_AF_MASK;
    }

    this.setPF_FLAG(result);
    this.setSF_FLAG(result);
    this.setZF_FLAG(result);
  }
}


