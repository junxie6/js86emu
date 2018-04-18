import {seg2abs, twosComplement2Int16, twosComplement2Int8} from "../utils/Utils";
import {
  regAH, regAL, regBH, regBL, regCH, regCL, regDH, regDL,
  regAX, regBX, regCX, regDX,
  regSI, regDI, regBP, regSP, regIP,
  regCS, regDS, regES, regSS,
  regFlags,
  FLAG_CF_MASK, FLAG_PF_MASK, FLAG_AF_MASK, FLAG_ZF_MASK, FLAG_SF_MASK,
  FLAG_TF_MASK, FLAG_IF_MASK, FLAG_DF_MASK, FLAG_OF_MASK, b, w, v
} from '../Constants';
import { formatOpcode, hexString16, hexString32 } from "../utils/Debug";
import {
  ValueOverflowException, FeatureNotImplementedException,
  InvalidAddressModeException
} from "../utils/Exceptions";

export default class Addressing {
  constructor(cpu) {
    this.cpu = cpu;
    this.mem8 = cpu.mem8;
    this.mem16 = cpu.mem16;
  }

  /**
   * Return a number value of 1.
   *
   * @param {number|null} segment Memory segment - Not used in this addressing mode
   * @param {number|null} value - Not used in this addressing mode
   * @return {number} Returns 0x01
   */
  _1 (segment, value) {
    return 0x01;
  }

  /**
   * Return a number value of 3.
   *
   * @param {number|null} segment Memory segment - Not used in this addressing mode
   * @param {number|null} value - Not used in this addressing mode
   * @return {number} Returns 0x03
   */
  _3 (segment, value) {
    return 0x03;
  }

  /**
   * Read or write a word value from/to the AX register.
   *
   * @param {number|null} segment Memory segment - Not used in this addressing mode
   * @param {number|null} value Value to write (word)
   * @return {number} For a read operation the value from the register is
   *  returned. For a write operation the same value provided is returned.
   */
  AX (segment, value) {
    let result;
    if (value || value === 0) result =  this.cpu.reg16[regAX] = value & 0xFFFF;
    else result = this.cpu.reg16[regAX];
    return result;
  }

  /**
   * Read or write a byte value from/to the AH register.
   *
   * @param {number|null} segment Memory segment - Not used in this addressing mode
   * @param {number|null} value Value to write (word)
   * @return {number} For a read operation the value from the register is
   *  returned. For a write operation the same value provided is returned.
   */
  AH (segment, value) {
    let result;
    if (value > 0xFF) throw new ValueOverflowException("Value too large for register");
    if (value || value === 0) result =  this.cpu.reg8[regAH] = value & 0xFF;
    else result = this.cpu.reg8[regAH];
    return result;
  }

  /**
   * Read or write a byte value from/to the AL register.
   *
   * @param {number|null} segment Memory segment - Not used in this addressing mode
   * @param {number|null} value Value to write (word)
   * @return {number} For a read operation the value from the register is
   *  returned. For a write operation the same value provided is returned.
   */
  AL (segment, value) {
    let result;
    if (value > 0xFF) throw new ValueOverflowException("Value too large for register");
    if (value || value === 0) result =  this.cpu.reg8[regAL] = value & 0xFF;
    else result = this.cpu.reg8[regAL];
    return result;
  }

  /**
   * Read or write a word value from/to the BX register.
   *
   * @param {number|null} segment Memory segment - Not used in this addressing mode
   * @param {number|null} value Value to write (word)
   * @return {number} For a read operation the value from the register is
   *  returned. For a write operation the same value provided is returned.
   */
  BX (segment, value) {
    let result;
    if (value || value === 0) result =  this.cpu.reg16[regBX] = value & 0xFFFF;
    else result = this.cpu.reg16[regBX];
    return result;
  }

  /**
   * Read or write a byte value from/to the BH register.
   *
   * @param {number|null} segment Memory segment - Not used in this addressing mode
   * @param {number|null} value Value to write (word)
   * @return {number} For a read operation the value from the register is
   *  returned. For a write operation the same value provided is returned.
   */
  BH (segment, value) {
    let result;
    if (value > 0xFF) throw new ValueOverflowException("Value too large for register");
    if (value || value === 0) result =  this.cpu.reg8[regBH] = value & 0xFF;
    else result = this.cpu.reg8[regBH];
    return result;
  }

  /**
   * Read or write a byte value from/to the BL register.
   *
   * @param {number|null} segment Memory segment - Not used in this addressing mode
   * @param {number|null} value Value to write (word)
   * @return {number} For a read operation the value from the register is
   *  returned. For a write operation the same value provided is returned.
   */
  BL (segment, value) {
    let result;
    if (value > 0xFF) throw new ValueOverflowException("Value too large for register");
    if (value || value === 0) result =  this.cpu.reg8[regBL] = value & 0xFF;
    else result = this.cpu.reg8[regBL];
    return result;
  }

  /**
   * Read or write a word value from/to the CX register.
   *
   * @param {number|null} segment Memory segment - Not used in this addressing mode
   * @param {number|null} value Value to write (word)
   * @return {number} For a read operation the value from the register is
   *  returned. For a write operation the same value provided is returned.
   */
  CX (segment, value) {
    let result;
    if (value || value === 0) result =  this.cpu.reg16[regCX] = value & 0xFFFF;
    else result = this.cpu.reg16[regCX];
    return result;
  }

  /**
   * Read or write a byte value from/to the CH register.
   *
   * @param {number|null} segment Memory segment - Not used in this addressing mode
   * @param {number|null} value Value to write (word)
   * @return {number} For a read operation the value from the register is
   *  returned. For a write operation the same value provided is returned.
   */
  CH (segment, value) {
    let result;
    if (value > 0xFF) throw new ValueOverflowException("Value too large for register");
    if (value || value === 0) result =  this.cpu.reg8[regCH] = value & 0xFF;
    else result = this.cpu.reg8[regCH];
    return result;
  }

  /**
   * Read or write a byte value from/to the CL register.
   *
   * @param {number|null} segment Memory segment - Not used in this addressing mode
   * @param {number|null} value Value to write (word)
   * @return {number} For a read operation the value from the register is
   *  returned. For a write operation the same value provided is returned.
   */
  CL (segment, value) {
    let result;
    if (value > 0xFF) throw new ValueOverflowException("Value too large for register");
    if (value || value === 0) result =  this.cpu.reg8[regCL] = value & 0xFF;
    else result = this.cpu.reg8[regCL];
    return result;
  }

  /**
   * Read or write a word value from/to the DX register.
   *
   * @param {number|null} segment Memory segment - Not used in this addressing mode
   * @param {number|null} value Value to write (word)
   * @return {number} For a read operation the value from the register is
   *  returned. For a write operation the same value provided is returned.
   */
  DX (segment, value) {
    let result;
    if (value || value === 0) result =  this.cpu.reg16[regDX] = value & 0xFFFF;
    else result = this.cpu.reg16[regDX];
    return result;
  }

  /**
   * Read or write a byte value from/to the DH register.
   *
   * @param {number|null} segment Memory segment - Not used in this addressing mode
   * @param {number|null} value Value to write (word)
   * @return {number} For a read operation the value from the register is
   *  returned. For a write operation the same value provided is returned.
   */
  DH (segment, value) {
    let result;
    if (value > 0xFF) throw new ValueOverflowException("Value too large for register");
    if (value || value === 0) result =  this.cpu.reg8[regDH] = value & 0xFF;
    else result = this.cpu.reg8[regDH];
    return result;
  }

  /**
   * Read or write a byte value from/to the DL register.
   *
   * @param {number|null} segment Memory segment - Not used in this addressing mode
   * @param {number|null} value Value to write (word)
   * @return {number} For a read operation the value from the register is
   *  returned. For a write operation the same value provided is returned.
   */
  DL (segment, value) {
    let result;
    if (value > 0xFF) throw new ValueOverflowException("Value too large for register");
    if (value || value === 0) result =  this.cpu.reg8[regDL] = value & 0xFF;
    else result = this.cpu.reg8[regDL];
    return result;
  }

  /**
   * Read or write a word value from/to the SI register.
   *
   * @param {number|null} segment Memory segment - Not used in this addressing mode
   * @param {number|null} value Value to write (word)
   * @return {number} For a read operation the value from the register is
   *  returned. For a write operation the same value provided is returned.
   */
  SI (segment, value) {
    let result;
    if (value || value === 0) result =  this.cpu.reg16[regSI] = value & 0xFFFF;
    else result = this.cpu.reg16[regSI];
    return result;
  }

  /**
   * Read or write a word value from/to the DI register.
   *
   * @param {number|null} segment Memory segment - Not used in this addressing mode
   * @param {number|null} value Value to write (word)
   * @return {number} For a read operation the value from the register is
   *  returned. For a write operation the same value provided is returned.
   */
  DI (segment, value) {
    let result;
    if (value || value === 0) result =  this.cpu.reg16[regDI] = value & 0xFFFF;
    else result = this.cpu.reg16[regDI];
    return result;
  }

  /**
   * Read or write a word value from/to the BP register.
   *
   * @param {number|null} segment Memory segment - Not used in this addressing mode
   * @param {number|null} value Value to write (word)
   * @return {number} For a read operation the value from the register is
   *  returned. For a write operation the same value provided is returned.
   */
  BP (segment, value) {
    let result;
    if (value || value === 0) result =  this.cpu.reg16[regBP] = value & 0xFFFF;
    else result = this.cpu.reg16[regBP];
    return result;
  }

  /**
   * Read or write a word value from/to the SP register.
   *
   * @param {number|null} segment Memory segment - Not used in this addressing mode
   * @param {number|null} value Value to write (word)
   * @return {number} For a read operation the value from the register is
   *  returned. For a write operation the same value provided is returned.
   */
  SP (segment, value) {
    let result;
    if (value || value === 0) result =  this.cpu.reg16[regSP] = value & 0xFFFF;
    else result = this.cpu.reg16[regSP];
    return result;
  }

  /**
   * Read or write a word value from/to the CS register.
   *
   * @param {number|null} segment Memory segment - Not used in this addressing mode
   * @param {number|null} value Value to write (word)
   * @return {number} For a read operation the value from the register is
   *  returned. For a write operation the same value provided is returned.
   */
  CS (segment, value) {
    let result;
    if (value || value === 0) result =  this.cpu.reg16[regCS] = value & 0xFFFF;
    else result = this.cpu.reg16[regCS];
    return result;
  }

  /**
   * Read or write a word value from/to the DS register.
   *
   * @param {number|null} segment Memory segment - Not used in this addressing mode
   * @param {number|null} value Value to write (word)
   * @return {number} For a read operation the value from the register is
   *  returned. For a write operation the same value provided is returned.
   */
  DS (segment, value) {
    let result;
    if (value || value === 0) result =  this.cpu.reg16[regDS] = value & 0xFFFF;
    else result = this.cpu.reg16[regDS];
    return result;
  }

  /**
   * Read or write a word value from/to the ES register.
   *
   * @param {number|null} segment Memory segment - Not used in this addressing mode
   * @param {number|null} value Value to write (word)
   * @return {number} For a read operation the value from the register is
   *  returned. For a write operation the same value provided is returned.
   */
  ES (segment, value) {
    let result;
    if (value || value === 0) result =  this.cpu.reg16[regES] = value & 0xFFFF;
    else result = this.cpu.reg16[regES];
    return result;
  }

  /**
   * Read or write a word value from/to the SS register.
   *   - [3] p. A-1 to A-3
   *
   * @param {number|null} segment Memory segment - Not used in this addressing mode
   * @param {number|null} value Value to write (word)
   * @return {number} For a read operation the value from the register is
   *  returned. For a write operation the same value provided is returned.
   */
  SS (segment, value) {
    let result;
    if (value || value === 0) result =  this.cpu.reg16[regSS] = value & 0xFFFF;
    else result = this.cpu.reg16[regSS];
    return result;
  }

  /**
   * Direct address. The instruction has no ModR/M byte; the address of the
   * operand is encoded in the instruction; and no base register, index
   * register, or scaling factor can be applied (for example, far JMP (EA))
   *
   * The operand is a 32-bit segment:offset pointer.
   *
   * For example:
   * 0x9A 0x12 0x34 0x56 0x78
   *
   * - [3] p. A-1 to A-3
   *
   * @param {number|null} segment Memory segment
   * @param {number|null} value NOT USED
   * @return {number[]} An array containing the [segment, offset]
   */
  Ap (segment, value) {
    if (value)
      throw new InvalidAddressModeException("Ap addressing mode can not set values");

    segment = this.cpu.reg16[regCS]; // Direct address values are in the CS segment

    // Get the 32bit far address (segment:offset) from the instruction argument
    let s = (this.cpu.mem8[seg2abs(segment, this.cpu.reg16[regIP] + 2, this.cpu)] << 8) |
             this.cpu.mem8[seg2abs(segment, this.cpu.reg16[regIP] + 1, this.cpu)];
    let o = (this.cpu.mem8[seg2abs(segment, this.cpu.reg16[regIP] + 4, this.cpu)] << 8) |
             this.cpu.mem8[seg2abs(segment, this.cpu.reg16[regIP] + 3, this.cpu)];

    this.cpu.addrIPInc += 4;
    return [s, o];
  }

  /**
   * A ModR/M byte follows the opcode and specifies the operand. The operand
   * is either a general-purpose register or a memory address. If it is a
   * memory address, the address is computed from a segment register and any
   * of the following values: a base register, an index register, a scaling
   * factor, a displacement.
   *
   * The operand is a byte, regardless of operand-size attribute.
   *   - [3] p. A-1 to A-3
   *
   * @param {number|null} segment Memory segment
   * @param {number|null} value Value to write (byte)
   * @return {number} For a read operation the value from the address is
   *  returned. For a write operation the same value provided is returned.
   */
  Eb (segment, value) {
    let result;
    if (value || value === 0) result = this.writeRMReg8(segment, value & 0xFF);
    else result = this.readRMReg8(segment);
    return result;
  }

  /**
   * A ModR/M byte follows the opcode and specifies the operand. The operand
   * is either a general-purpose register or a memory address. If it is a
   * memory address, the address is computed from a segment register and any
   * of the following values: a base register, an index register, a scaling
   * factor, a displacement.
   *
   * 32-bit or 48-bit pointer, depending on operand-size attribute.
   *   - [3] p. A-1 to A-3
   *
   * @param {number|null} segment Memory segment
   * @param {number|null} value NOT USED
   * @return {number[]} An array containing the [segment, offset]
   */
  Ep (segment, value) {
    if (value)
      throw new InvalidAddressModeException("Ep addressing mode can not set values");
    // segment = this.cpu.reg16[regCS]; // Ep values are in the CS segment
    let result = this.readRMReg32(segment);
    let s = result & 0x0000FFFF;
    let o = (result & 0xFFFF0000) >> 16;
    return [s, o];
  }

  /**
   * A ModR/M byte follows the opcode and specifies the operand. The operand
   * is either a general-purpose register or a memory address. If it is a
   * memory address, the address is computed from a segment register and any
   * of the following values: a base register, an index register, a scaling
   * factor, a displacement.
   *
   * The operand is a word or doubleword, depending on operand-size attribute.
   *   - [3] p. A-1 to A-3
   *
   * @param {number|null} segment Memory segment
   * @param {number|null} value Value to write (word|doubleword)
   * @return {number} For a read operation the value from the address is
   *  returned. For a write operation the same value provided is returned.
   */
  Ev (segment, value) {
    let result;
    if (value || value === 0) result = this.writeRMReg16(segment, value & 0xFFFF);
    else result = this.readRMReg16(segment);
    return result;
  }

  EvAddr () {

  }

  /**
   * A ModR/M byte follows the opcode and specifies the operand. The operand
   * is either a general-purpose register or a memory address. If it is a
   * memory address, the address is computed from a segment register and any
   * of the following values: a base register, an index register, a scaling
   * factor, a displacement.
   *
   * The operand is a word, regardless of operand-size attribute.
   *   - [3] p. A-1 to A-3
   *
   * @param {number|null} segment Memory segment
   * @param {number|null} value Value to write (word)
   * @return {number} For a read operation the value from the address is
   *  returned. For a write operation the same value provided is returned.
   */
  Ew (segment, value) {
    let result;
    if (value || value === 0) result = this.writeRMReg16(segment, value & 0xFFFF);
    else result = this.readRMReg16(segment);
    return result;
  }

  /**
   * The reg field of the ModR/M byte selects a general register (for example,
   * AX (000)).
   *
   * The operand is a byte, regardless of operand-size attribute.
   *   - [3] p. A-1 to A-3
   *
   * @param {number|null} segment Memory segment - Not used in this addressing mode
   * @param {number|null} value Value to write (byte)
   * @return {number} For a read operation the value from the address is
   *  returned. For a write operation the same value provided is returned.
   */
  Gb (segment, value) {
    let result;
    if (value || value === 0) result = this.writeRegVal(value & 0xFF, false, b);
    else result = this.readRegVal(false, b);
    return result;
  }

  /**
   * The reg field of the ModR/M byte selects a general register (for example,
   * AX (000)).
   *
   * The operand is a word or doubleword, depending on operand-size attribute.
   *   - [3] p. A-1 to A-3
   *
   * @param {number|null} segment Memory segment - Not used in this addressing mode
   * @param {number|null} value Value to write (word|doubleword)
   * @return {number} For a read operation the value from the address is
   *  returned. For a write operation the same value provided is returned.
   */
  Gv (segment, value) {
    let result;
    if (value || value === 0) result = this.writeRegVal(value & 0xFFFF, false, v);
    else result = this.readRegVal(false, v);
    return result;
  }

  /**
   * Immediate data. The operand value is encoded in subsequent bytes of the
   * instruction.
   *
   * The operand is a byte, regardless of operand-size attribute.
   *   - [3] p. A-1 to A-3
   *
   * @param {number|null} segment Memory segment
   * @param {number|null} value NOT USED
   * @return {number} For a read operation the value from the address is
   *  returned. For a write operation the same value provided is returned.
   */
  Ib (segment, value) {
    let result;

    segment = this.cpu.reg16[regCS]; // Imm values are in the CS segment
    let offset = this.cpu.reg16[regIP] + this.cpu.instIPInc;

    if (value || value === 0) throw new InvalidAddressModeException("Ib addressing mode can not set values");
    else result = this.readMem8(segment, offset);

    this.cpu.addrIPInc += 1;
    return result;
  }

  /**
   * Immediate data. The operand value is encoded in subsequent bytes of the
   * instruction.
   *
   * The operand is a word or doubleword, depending on operand-size attribute.
   *   - [3] p. A-1 to A-3
   *
   * @param {number|null} segment Memory segment
   * @param {number|null} value NOT USED
   * @return {number} For a read operation the value from the address is
   *  returned. For a write operation the same value provided is returned.
   */
  Iv (segment, value) {
    // this.blah = function() { console.log("HERE!"); };

    let result;

    segment = this.cpu.reg16[regCS]; // Imm values are in the CS segment
    let offset = this.cpu.reg16[regIP] + this.cpu.instIPInc;

    if (value || value === 0) throw new InvalidAddressModeException("Iv addressing mode can not set values");
    else result = this.readMem16(segment, offset);

    this.cpu.addrIPInc += 2;

    return result;
  }

  /**
   * Immediate data. The operand value is encoded in subsequent bytes of the
   * instruction.
   *
   * The operand is a word, regardless of operand-size attribute.
   *   - [3] p. A-1 to A-3
   *
   * @param {number|null} segment Memory segment
   * @param {number|null} value NOT USED
   * @return {number} For a read operation the value from the address is
   *  returned. For a write operation the same value provided is returned.
   */
  Iw (segment, value) {
    let result;

    segment = this.cpu.reg16[regCS]; // Imm values are in the CS segment
    let offset = this.cpu.reg16[regIP] + this.cpu.instIPInc;

    if (value || value === 0) InvalidAddressModeException("Iw addressing mode can not set values");
    else result = this.readMem16(segment, offset);

    this.cpu.addrIPInc += 2;

    return result;
  }

  /**
   * The instruction contains a relative offset to be added to the instruction
   * pointer register (for example, JMP (0E9), LOOP).
   *
   * The operand is a word, regardless of operand-size attribute.
   *   - [3] p. A-1 to A-3
   *
   * @param {number|null} segment NOT USED
   * @param {number|null} value NOT USED
   * @return {number} The value from the address is returned
   */
  Jb (segment, value) {
    if (value) throw new InvalidAddressModeException("Jb addressing mode can not set values");

    let offset = this.cpu.reg16[regIP] + this.cpu.instIPInc;

    let result = this.readMem8(this.cpu.reg16[regCS], offset);

    this.cpu.addrIPInc += 1;

    return this.cpu.reg16[regIP] + twosComplement2Int8(result);
  }

  /**
   * The instruction contains a relative offset to be added to the instruction
   * pointer register (for example, JMP (0E9), LOOP).
   *
   * The operand is a word or doubleword, depending on operand-size attribute.
   *   - [3] p. A-1 to A-3
   *
   * @param {number|null} segment Memory segment
   * @param {number|null} value NOT USED
   * @return {number} The value from the address is returned
   */
  Jv (segment, value) {
    if (value)
      throw new InvalidAddressModeException("Jv addressing mode can not set values")

    let offset = this.cpu.reg16[regIP] + this.cpu.instIPInc;

    let result = this.readMem16(this.cpu.reg16[regCS], offset);

    this.cpu.addrIPInc += 2;

    return this.cpu.reg16[regIP] + twosComplement2Int16(result);
  }

  /**
   * The ModR/M byte may refer only to memory (for example, BOUND, LES, LDS,
   * LSS, LFS, LGS, CMPXCHG8B).
   *   - [3] p. A-1 to A-3
   *
   * @param {number|null} segment Memory segment
   * @param {number|null} value NOT USED
   * @return {number} The value from the address is returned
   */
  M (segment, value) {
    if (value)
      throw new InvalidAddressModeException("M addressing mode can not set values");

    let addr;
    switch (this.cpu.opcode.mod) {
      case 0b00: // Use R/M Table 1 for R/M operand
        addr = this.calcRMAddr(segment);
        break;
      case 0b01: // Use R/M Table 2 with 8-bit displacement
      case 0b10: // Use R/M Table 2 with 16-bit displacement
        addr = this.calcRMDispAddr(segment);
        break;
    }
    return addr
  }

  /**
   * The ModR/M byte may refer only to memory (for example, BOUND, LES, LDS,
   * LSS, LFS, LGS, CMPXCHG8B).
   *
   * 32-bit or 48-bit pointer, depending on operand-size attribute.
   *   - [3] p. A-1 to A-3
   *
   * @param {number|null} segment Memory segment
   * @param {number|null} value NOT USED
   * @return {number[]} An array containing the [segment, offset]
   */
  Mp (segment, value) {
    if (value)
      throw new InvalidAddressModeException("Mp addressing mode can not set values");

    // segment = this.cpu.reg16[regCS]; // MP values are in the CS segment

    let addr;
    switch (this.cpu.opcode.mod) {
      case 0b00: // Use R/M Table 1 for R/M operand
        addr = this.calcRMAddr(segment);
        break;
      case 0b01: // Use R/M Table 2 with 8-bit displacement
      case 0b10: // Use R/M Table 2 with 16-bit displacement
        addr = this.calcRMDispAddr(segment);
        break;
    }

    let o = this.readMem16(segment, addr);
    let s = this.readMem16(segment, addr + 2);

    return [s, o];
  }

  Ob (segment, value) {

  }

  Ov (segment, value) {

  }

  Sw (segment, value) {

  }

  /**
   * Read a byte from memory or a register as specified by the addressing
   * mode determined by the mod, reg and r/m values.
   *
   * @param {number|null} segment Memory segment
   */
  readRMReg8 (segment) {
    let offset;
    switch (this.cpu.opcode.mod) {
      case 0b00: // Use R/M Table 1 for R/M operand
        offset = this.calcRMAddr(segment);
        return this.readMem8(segment, offset);
      case 0b01: // Use R/M Table 2 with 8-bit displacement
      case 0b10: // Use R/M Table 2 with 16-bit displacement
        offset = this.calcRMDispAddr(segment);
        return this.readMem8(segment, offset);
      case 0b11: // Two register instruction; use REG table
        return this.readRegVal(true);
    }
  }

  /**
   * Read a word from memory or a register as specified by the addressing
   * mode determined by the mod, reg and r/m values.
   *
   * @param {number} segment Memory segment
   */
  readRMReg16 (segment) {
    let offset;
    switch (this.cpu.opcode.mod) {
      case 0b00: // Use R/M Table 1 for R/M operand
        offset = this.calcRMAddr(segment);
        return this.readMem16(segment, offset);
      case 0b01: // Use R/M Table 2 with 8-bit displacement
      case 0b10: // Use R/M Table 2 with 16-bit displacement
        offset = this.calcRMDispAddr(segment);
        return this.readMem16(segment, offset);
      case 0b11: // Two register instruction; use REG table
        return this.readRegVal(true);
    }
  }

  /**
   * Read a double word from memory or a register as specified by the
   * addressing mode determined by the mod, reg and r/m values.
   *
   * @param {number} segment Memory segment
   */
  readRMReg32 (segment) {
    let offset;
    switch (this.cpu.opcode.mod) {
      case 0b00: // Use R/M Table 1 for R/M operand
        offset = this.calcRMAddr(segment);
        return this.readMem32(segment, offset);
      case 0b01: // Use R/M Table 2 with 8-bit displacement
      case 0b10: // Use R/M Table 2 with 16-bit displacement
        offset = this.calcRMDispAddr(segment);
        return this.readMem32(segment, offset);
      case 0b11: // Two register instruction; use REG table
        return this.readRegVal(true);
    }
  }

  /**
   * Write a byte to memory or a register as specified by the addressing
   * mode determined by the mod, reg and r/m values.
   *
   * @param {number} segment Memory segment
   * @param {number} value Value to write to memory (byte)
   */
  writeRMReg8(segment, value) {
    let offset;
    switch (this.cpu.opcode.mod) {
      case 0b00: // Use R/M Table 1 for R/M operand
        offset = this.calcRMAddr(segment);
        return this.writeMem8(segment, offset, value);
      case 0b01: // Use R/M Table 2 with 8-bit displacement
      case 0b10: // Use R/M Table 2 with 16-bit displacement
        offset = this.calcRMDispAddr(segment);
        return this.writeMem8(segment, offset, value);
      case 0b11: // Two register instruction; use REG table
        return this.writeRegVal(value, true);
    }
  }

  /**
   * Write a word to memory or a register as specified by the addressing
   * mode determined by the mod, reg and r/m values.
   *
   * @param {number} segment Memory segment
   * @param {number} value Value to write to memory (word)
   */
  writeRMReg16(segment, value) {
    let offset;
    switch (this.cpu.opcode.mod) {
      case 0b00: // Use R/M Table 1 for R/M operand
        offset = this.calcRMAddr(segment);
        return this.writeMem16(segment, offset, value);
      case 0b01: // Use R/M Table 2 with 8-bit displacement
      case 0b10: // Use R/M Table 2 with 16-bit displacement
        offset = this.calcRMDispAddr(segment);
        return this.writeMem16(segment, offset, value);
      case 0b11: // Two register instruction; use REG table
        return this.writeRegVal(value, true);
    }
  }

  /**
   * Calculate an offset address in RM addressing mode
   *
   * I don't think there's a difference between the functionality for a byte
   * or a word for calcRMAddr. If I'm wrong come back to this.
   *
   * Note: This returns an offset, this address does not account for segment.
   * Use seg2abs() to get the segmented address.
   *
   * TODO: segment is no longer needed
   *
   * @param {number} segment Memory segment
   * @return {number} Calculated address
   */
  calcRMAddr (segment) {
    let addr;

    switch (this.cpu.opcode.rm)
    {
      case 0b000 : // [BX + SI]
        addr = this.cpu.reg16[regBX] + this.cpu.reg16[regSI];
        break;
      case 0b001 : // [BX + DI]
        addr = this.cpu.reg16[regBX] + this.cpu.reg16[regDI];
        break;
      case 0b010 : // [BP + SI]
        addr = this.cpu.reg16[regBP] + this.cpu.reg16[regSI];
        this.cpu.addrSeg = regSS;
        break;
      case 0b011 : // [BP + DI]
        addr = this.cpu.reg16[regBP] + this.cpu.reg16[regDI];
        this.cpu.addrSeg = regSS;
        break;
      case 0b100 : // [SI]
        addr = this.cpu.reg16[regSI];
        break;
      case 0b101 : // [DI]
        addr = this.cpu.reg16[regDI];
        break;
      case 0b110 : // Direct Address
        // Direct address is always 2 bytes
        //   - yoshicapstonememo.googlecode.com/svn/trunk/4_2_86.pdf
        addr = (this.cpu.mem8[seg2abs( this.cpu.reg16[regCS], this.cpu.reg16[regIP] + 3, this.cpu)] << 8) |
                this.cpu.mem8[seg2abs( this.cpu.reg16[regCS], this.cpu.reg16[regIP] + 2, this.cpu)];
        if (this.cpu.addrIPInc === 0) this.cpu.addrIPInc += 2;
        break;
      case 0b111 : // [BX]
        addr = this.cpu.reg16[regBX];
        break;
    }
    return addr;
  }

  /**
   * Calculate an offset address in RM addressing mode with a displacement word
   *
   * Note: This returns an offset, this address does not account for segment.
   * Use seg2abs() to get the segmented address.
   *
   * @param {number} segment Memory segment
   * @return {number} Calculated address
   */
  calcRMDispAddr (segment) {
    let addr, disp;

    switch (this.cpu.opcode.mod) {
      case 0b01: // Use R/M table 2 with 8-bit displacement
        disp = this.cpu.mem8[seg2abs(this.cpu.reg16[regCS], this.cpu.reg16[regIP] + 2, this.cpu)];
        this.cpu.addrIPInc += 1;
        break;
      case 0b10: // Use R/M table 2 with 16-bit displacement
        disp = disp ||
          ((this.cpu.mem8[seg2abs(this.cpu.reg16[regCS], this.cpu.reg16[regIP] + 3, this.cpu)] << 8) |
            this.cpu.mem8[seg2abs(this.cpu.reg16[regCS], this.cpu.reg16[regIP] + 2, this.cpu)] );
        if (this.cpu.addrIPInc === 0) this.cpu.addrIPInc += 2;
    }

    switch (this.cpu.opcode.rm) {
      case 0b000 : // [BX + SI] + disp
        addr = this.cpu.reg16[regBX] + this.cpu.reg16[regSI] + disp;
        break;
      case 0b001 : // [BX + DI] + disp
        addr = this.cpu.reg16[regBX] + this.cpu.reg16[regDI] + disp;
        break;
      case 0b010 : // [BP + SI] + disp
        addr = this.cpu.reg16[regBP] + this.cpu.reg16[regSI] + disp;
        break;
      case 0b011 : // [BP + DI] + disp
        addr = this.cpu.reg16[regBP] + this.cpu.reg16[regDI] + disp;
        break;
      case 0b100 : // [SI] + disp
        addr = this.cpu.reg16[regSI] + disp;
        break;
      case 0b101 : // [DI] + disp
        addr = this.cpu.reg16[regDI] + disp;
        break;
      case 0b110 : // [BP] + disp
        addr = this.cpu.reg16[regBP] + disp;
        break;
      case 0b111 : // [BX] + disp
        addr = this.cpu.reg16[regBX] + disp;
        break;
    }
    return addr;
  }

  /**
   * Read a byte or a word from a register determined by the rm or reg value
   * and the reg lookup table.
   *
   * @param {boolean} useRM Use the RM value rather than the default REG value
   * @param {number} sizeOverride If given override the w bit for the operand size
   * @returns {number} The value of the register
   */
  readRegVal (useRM = false, sizeOverride=null) {
    let rmReg = useRM ? this.cpu.opcode.rm : this.cpu.opcode.reg;
    let size;
    if (sizeOverride !== null) {
      if (sizeOverride === b) size = 0;
      else size = 1;
    }
    else {
      size = this.cpu.opcode.w;
    }
    switch (size) {
      case 0:
        switch (rmReg) {
          case 0b000:
            return this.cpu.reg8[regAL];
          case 0b001:
            return this.cpu.reg8[regCL];
          case 0b10:
            return this.cpu.reg8[regDL];
          case 0b011:
            return this.cpu.reg8[regBL];
          case 0b100:
            return this.cpu.reg8[regAH];
          case 0b101:
            return this.cpu.reg8[regCH];
          case 0b110:
            return this.cpu.reg8[regDH];
          case 0b111:
            return this.cpu.reg8[regBH];
        }
        break;
      case 1:
        switch (rmReg) {
          case 0b000:
            return this.cpu.reg16[regAX];
          case 0b001:
            return this.cpu.reg16[regCX];
          case 0b010:
            return this.cpu.reg16[regDX];
          case 0b011:
            return this.cpu.reg16[regBX];
          case 0b100:
            return this.cpu.reg16[regSP];
          case 0b101:
            return this.cpu.reg16[regBP];
          case 0b110:
            return this.cpu.reg16[regSI];
          case 0b111:
            return this.cpu.reg16[regDI];
        }
        break;
    }
  }

  /**
   * Write a byte or a word to a register determined by the rm or reg value
   * and the reg lookup table.
   *
   * @param {number} value Value to write to the register
   * @param {boolean} useRM Use the RM value rather than the default REG value
   * @param {number} sizeOverride If given override the w bit for the operand size
   */
  writeRegVal (value, useRM = false, sizeOverride=null) {
    let rmReg = useRM ? this.cpu.opcode.rm : this.cpu.opcode.reg;
    let size;
    if (sizeOverride !== null) {
      if (sizeOverride === b) size = 0;
      else size = 1;
    }
    else {
      size = this.cpu.opcode.w;
    }
    switch (size) {
      case 0:
        switch (rmReg) {
          case 0b000:
            this.cpu.reg8[regAL] = value;
            break;
          case 0b001:
            this.cpu.reg8[regCL] = value;
            break;
          case 0b10:
            this.cpu.reg8[regDL] = value;
            break;
          case 0b011:
            this.cpu.reg8[regBL] = value;
            break;
          case 0b100:
            this.cpu.reg8[regAH] = value;
            break;
          case 0b101:
            this.cpu.reg8[regCH] = value;
            break;
          case 0b110:
            this.cpu.reg8[regDH] = value;
            break;
          case 0b111:
            this.cpu.reg8[regBH] = value;
            break;
        }
        break;
      case 1:
        switch (rmReg) {
          case 0b000:
            this.cpu.reg16[regAX] = value;
            break;
          case 0b001:
            this.cpu.reg16[regCX] = value;
            break;
          case 0b10:
            this.cpu.reg16[regDX] = value;
            break;
          case 0b011:
            this.cpu.reg16[regBX] = value;
            break;
          case 0b100:
            this.cpu.reg16[regSP] = value;
            break;
          case 0b101:
            this.cpu.reg16[regBP] = value;
            break;
          case 0b110:
            this.cpu.reg16[regSI] = value;
            break;
          case 0b111:
            this.cpu.reg16[regDI] = value;
            break;
        }
        break;
    }
  }

  /**
   * Read a byte from a segment:offset location in memory
   *
   * @param {number} segment
   * @param {number} offset
   * @return {number} Value from memory as a byte
   */
  readMem8(segment, offset) {
    return this.cpu.mem8[seg2abs(segment, offset, this.cpu)];
  }

  /**
   * Read a word from a segment:offset location in memory
   *
   * @param {number} segment
   * @param {number} offset
   * @return {number} Value from memory as a word
   */
  readMem16(segment, offset) {
    return ((this.cpu.mem8[seg2abs(segment, offset + 1, this.cpu)] << 8) |
             this.cpu.mem8[seg2abs(segment, offset, this.cpu)]);
  }

  /**
   * Read a double word from a segment:offset location in memory
   *
   * @param {number} segment
   * @param {number} offset
   * @return {number} Value from memory as a double word
   */
  readMem32(segment, offset) {
    return ((this.cpu.mem8[seg2abs(segment, offset + 1, this.cpu)] << 24) |
            (this.cpu.mem8[seg2abs(segment, offset    , this.cpu)] << 16) |
            (this.cpu.mem8[seg2abs(segment, offset + 3, this.cpu)] << 8) |
             this.cpu.mem8[seg2abs(segment, offset + 2, this.cpu)]);
  }

  /**
   * Write a byte to a segment:offset location in memory
   *
   * @param {number} segment
   * @param {number} offset
   * @param {number} value
   */
  writeMem8(segment, offset, value) {
    this.cpu.mem8[seg2abs(segment, offset, this.cpu)] = (value & 0x00FF);
  }

  /**
   * Write a word to a segment:offset location in memory
   *
   * @param {number} segment
   * @param {number} offset
   * @param {number} value
   */
  writeMem16(segment, offset, value) {
    this.cpu.mem8[seg2abs(segment, offset, this.cpu)] = (value & 0x00FF);
    this.cpu.mem8[seg2abs(segment, offset + 1, this.cpu)] = (value >> 8 & 0x00FF);
  }
}
