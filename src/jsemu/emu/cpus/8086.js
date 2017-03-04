/**
 * 8086 CPU
 *
 * TODO: Verify this information
 * The video RAM starts at address 8000h,
 *
 * (from http://www.cpu-world.com/Arch/8086.html)
 *
 * Program memory - program can be located anywhere in memory. Jump and
 * call instructions can be used for short jumps within currently selected
 * 64 KB code segment, as well as for far jumps anywhere within 1 MB of
 * memory. All conditional jump instructions can be used to jump within
 * approximately +127 - -127 bytes from current instruction.
 *
 * Data memory - the 8086 processor can access data in any one out of 4
 * available segments, which limits the size of accessible memory to 256 KB
 * (if all four segments point to different 64 KB blocks). Accessing data
 * from the Data, Code, Stack or Extra segments can be usually done by
 * prefixing instructions with the DS:, CS:, SS: or ES: (some registers and
 * instructions by default may use the ES or SS segments instead of DS
 * segment).
 *
 * Word data can be located at odd or even byte boundaries. The processor
 * uses two memory accesses to read 16-bit word located at odd byte
 * boundaries. Reading word data from even byte boundaries requires only
 * one memory access.
 *
 * Stack memory can be placed anywhere in memory. The stack can be located
 * at odd memory addresses, but it is not recommended for performance
 * reasons (see "Data Memory" above).
 *
 * Reserved locations:
 *
 * 0000h - 03FFh are reserved for interrupt vectors. Each interrupt vector
 * is a 32-bit pointer in format segment:offset.
 *
 * FFFF0h - FFFFFh - after RESET the processor always starts program
 * execution at the FFFF0h address.
 *
 * @module Emu
 * @author Chad Rempp <crempp@gmail.com>
 */
define([
    "emu/exceptions",
    "gui/models/SettingsModel"
],
function(
    EmuExceptions,
    SettingsModel
)
{
    var _Cpu = null;

    var _Gui = null

    var _settings = null;

    var _breakOnError = false;

    // Temporary IP counter. Tracks IP increment as instruction runs.
    var _tempIP = 0;

    // Segment override flags
    var _CS_OVERRIDE = false;
    var _DS_OVERRIDE = false;
    var _ES_OVERRIDE = false;
    var _SS_OVERRIDE = false

    var Cpu8086 = {

        bios_rom_address: 0xF0100,
        video_rom_address: 0xC0000,

        tmpBios : null,

        _opcode  : 0x00,
        _memory  : null,
        _memoryV : null,

        _ports   : null,
        _portsV  : null,

        //halt     : false,

        // Main Registers
        _regAH : null, _regAL : null, // primary accumulator
        _regBH : null, _regBL : null, // base, accumulator
        _regCH : null, _regCL : null, // counter, accumulator
        _regDH : null, _regDL : null, // accumulator, other functions

        // Index registers
        _regSI : null, // Source Index
        _regDI : null, // Destination Index
        _regBP : null, // Base Pointer
        _regSP : null, // Stack Pointer

        // Program counter
        _regIP : null, // Instruction Pointer

        // Segment registers
        _regCS : null, // Code Segment
        _regDS : null, // Data Segment
        _regES : null, // ExtraSegment
        _regSS : null, // Stack Segment

        // Status register
        // MASK   BIT  Flag   NAME
        // 0x0001 0    CF     Carry flag  S
        // 0x0002 1    1      Reserved
        // 0x0004 2    PF     Parity flag S
        // 0x0008 3    0      Reserved
        // 0x0010 4    AF     Adjust flag S
        // 0x0020 5    0      Reserved
        // 0x0040 6    ZF     Zero flag   S
        // 0x0080 7    SF     Sign flag   S
        // 0x0100 8    TF     Trap flag (single step) X
        // 0x0200 9    IF     Interrupt enable flag   C
        // 0x0400 10   DF     Direction flag  C
        // 0x0800 11   OF     Overflow flag   S
        // 0x1000 12,13 1,1   I/O privilege level (286+ only) always 1 on 8086 and 186
        // 0x2000 14  1       Nested task flag (286+ only) always 1 on 8086 and 186
        // 0x4000 15  1       on 8086 and 186, should be 0 above  Reserved
        _regFlags : null,

        FLAG_CF_MASK : 0x0001,
        FLAG_PF_MASK : 0x0004,
        FLAG_AF_MASK : 0x0010,
        FLAG_ZF_MASK : 0x0040,
        FLAG_SF_MASK : 0x0080,
        FLAG_TF_MASK : 0x0100,
        FLAG_IF_MASK : 0x0200,
        FLAG_DF_MASK : 0x0400,
        FLAG_OF_MASK : 0x0800,

        _decode : function (opcode_byte, addressing_byte) {
            /**
             * Decode the opcode bytes
             */
            return {
                opcode_byte : opcode_byte,
                addressing_byte : addressing_byte,
                prefix : 0x00, // Not supporting prefix opcodes yet
                opcode : (opcode_byte & 0xFC) >>> 2,
                d      : (opcode_byte & 0x02) >>> 1,
                w      : (opcode_byte & 0x01),
                mod    : (addressing_byte & 0xC0) >>> 6,
                reg    : (addressing_byte & 0x38) >>> 3,
                rm     : (addressing_byte & 0x07),
                cycle  : _Cpu._cycles
            };
        },

        /**
         * Looks up the correct register to use based on the w and reg
         * values in the opcode.
         *
         * Returns the value from the register
         *
         * @param opcode
         * @private
         */
        _getRegValueForOp : function (opcode) {
            if (0 === opcode.w)
            {
                switch (opcode.reg)
                {
                    case 0: // 000
                        return this._regAL;
                    case 1: // 001
                        return this._regCL;
                    case 2: // 010
                        return this._regDL;
                    case 3: // 011
                        return this._regBL;
                    case 4: // 100
                        return this._regAH;
                    case 5: // 101
                        return this._regCH;
                    case 6: // 110
                        return this._regDH;
                    case 7: // 111
                        return this._regBH;
                    default:
                        if (_breakOnError) _Cpu.halt({
                            error      : true,
                            enterDebug : true,
                            message    : "Invalid reg table lookup parameters",
                            decObj     : opcode,
                            regObj     : this._bundleRegisters(),
                            memObj     : this._memoryV
                        });
                }
            }
            else if (1 === opcode.w)
            {
                switch (opcode.reg)
                {
                    case 0:
                        return ((this._regAH << 8) | this._regAL);
                    case 1:
                        return ((this._regCH << 8) | this._regCL);
                    case 2:
                        return ((this._regDH << 8) | this._regDL);
                    case 3:
                        return ((this._regBH << 8) | this._regBL);
                    case 4:
                        return this._regSP;
                    case 5:
                        return this._regBP;
                    case 6:
                        return this._regSI;
                    case 7:
                        return this._regDI;
                    default:
                        if (_breakOnError) _Cpu.halt({
                            error      : true,
                            enterDebug : true,
                            message    : "Invalid reg table lookup parameters",
                            decObj     : opcode,
                            regObj     : this._bundleRegisters(),
                            memObj     : this._memoryV
                        });
                }
            }
            else
            {
                if (_breakOnError) _Cpu.halt({
                    error      : true,
                    enterDebug : true,
                    message    : "Invalid reg table lookup parameters",
                    decObj     : opcode,
                    regObj     : this._bundleRegisters(),
                    memObj     : this._memoryV
                })
            }
        },

        _getRMValueForOp : function (opcode)
        {
            var addr;

            // Use R/M Table 1 with no displacement
            if (0 === opcode.mod)
            {
                switch (opcode.rm)
                {
                    case 0 : // [BX + SI]
                        addr = ( ((this._regBH << 8) | this._regBL) + this._regSI );
                        break;
                    case 1 : // [BX + DI]
                        addr = ( ((this._regBH << 8) | this._regBL) + this._regDI );
                        break;
                    case 2 : // [BP + SI]
                        addr = ( this._regBP + this._regSI );
                        break;
                    case 3 : // [BP + DI]
                        addr = ( this._regBP + this._regDI );
                        break;
                    case 4 : // [SI]
                        addr = ( this._regSI );
                        break;
                    case 5 : // [DI]
                        addr = ( this._regDI );
                        break;
                    case 6 : // Drc't Add
                        // Direct address is always 2 bytes
                        // yoshicapstonememo.googlecode.com/svn/trunk/4_2_86.pdf
                        _tempIP += 2;
                        addr = (this._memoryV[this.segment2absolute(this._regCS, this._regIP + 3)] << 8) |
                                this._memoryV[this.segment2absolute(this._regCS, this._regIP + 2)];
                        break;
                    case 7 : // [BX]
                        addr = ( (this._regBH << 8) | this._regBL );
                        break;
                }
                if (0 === opcode.w)
                {
                    return (this._memoryV[this.segment2absolute(this._regCS, addr)]);
                }
                else
                {
                    return ((this._memoryV[this.segment2absolute(this._regCS, addr + 1)] << 8) |
                             this._memoryV[this.segment2absolute(this._regCS, addr)]);
                }
            }
            // Use R/M Table 2 with 8-bit signed displacement
            else if (1 === opcode.mod || 2 == opcode.mod)
            {
                var disp;
                if (1 === opcode.mod) {
                    disp = this._memoryV[this.segment2absolute(this._regCS, this._regIP + 2)];
                    _tempIP += 1;
                } else {
                    disp = ( (this._memoryV[this.segment2absolute(this._regCS, this._regIP + 3)] << 8) |
                              this._memoryV[this.segment2absolute(this._regCS, this._regIP + 2)] );
                    _tempIP += 2;
                }

                switch (opcode.rm)
                {
                    case 0 : // [BX + SI]
                        addr = ( ((this._regBH << 8) | this._regBL) + this._regSI + disp );
                        break;
                    case 1 : // [BX + DI]
                        addr = ( ((this._regBH << 8) | this._regBL) + this._regDI + disp );
                        break;
                    case 2 : // [BP + SI]
                        addr = ( this._regBP + this._regSI + disp );
                        break;
                    case 3 : // [BP + DI]
                        addr = ( this._regBP + this._regDI + disp );
                        break;
                    case 4 : // [SI]
                        addr = ( this._regSI + disp );
                        break;
                    case 5 : // [DI]
                        addr = ( this._regDI + disp );
                        break;
                    case 6 : // [BP]
                        addr = ( this._regBP + disp );
                        break;
                    case 7 : // [BX]
                        addr = ( ((this._regBH << 8) | this._regBL) + disp );
                        break;
                }
                if (0 === opcode.w)
                {
                    return (this._memoryV[this.segment2absolute(this._regCS, addr)]);
                }
                else
                {
                    return ((this._memoryV[this.segment2absolute(this._regCS, addr + 1)] << 8) |
                             this._memoryV[this.segment2absolute(this._regCS, addr)]);
                }
            }
            // R/M bits refer to REG tables
            else if (3 === opcode.mod)
            {
                // The following helper will increase the IP so we don't have to here
                return this._getRegValueForOp({w:opcode.w, d:opcode.d, reg:opcode.rm, rm:opcode.rm});
            }
            else
            {
                if (_breakOnError) _Cpu.halt({
                    error      : true,
                    enterDebug : true,
                    message    : "Invalid r/m table lookup parameters",
                    decObj     : opcode,
                    regObj     : this._bundleRegisters(),
                    memObj     : this._memoryV
                });
            }
            return 0;
        },

        /**
         * Looks up the correct register to use based on the w and reg
         * values in the opcode.
         *
         * Sets the register to the given value
         *
         * @param opcode
         * @param value
         * @private
         */
        _setRegValueForOp : function (opcode, value) {
            if (0 === opcode.w)
            {
                switch (opcode.reg)
                {
                    case 0:
                        this._regAL = (value & 0x00FF);
                        break;
                    case 1:
                        this._regCL = (value & 0x00FF);
                        break;
                    case 2:
                        this._regDL = (value & 0x00FF);
                        break;
                    case 3:
                        this._regBL = (value & 0x00FF);
                        break;
                    case 4:
                        this._regAH = (value & 0x00FF);
                        break;
                    case 5:
                        this._regCH = (value & 0x00FF);
                        break;
                    case 6:
                        this._regDH = (value & 0x00FF);
                        break;
                    case 7:
                        this._regBH = (value & 0x00FF);
                        break;
                }
            }
            else if (1 === opcode.w)
            {
                switch (opcode.reg)
                {
                    case 0:
                        this._regAH = ((value >> 8) & 0x0FF);
                        this._regAL = (value & 0x00FF);
                        break;
                    case 1:
                        this._regCH = ((value >> 8) & 0x0FF);
                        this._regCL = (value & 0x00FF);
                        break;
                    case 2:
                        this._regDH = ((value >> 8) & 0x0FF);
                        this._regDL = (value & 0x00FF);
                        break;
                    case 3:
                        this._regBH = ((value >> 8) & 0x0FF);
                        this._regBL = (value & 0x00FF);
                        break;
                    case 4:
                        this._regSP = (value & 0xFFFF);
                        break;
                    case 5:
                        this._regBP = (value & 0xFFFF);
                        break;
                    case 6:
                        this._regSI = (value & 0xFFFF);
                        break;
                    case 7:
                        this._regDI = (value & 0xFFFF);
                        break;
                }
            }
            else
            {
                if (_breakOnError) _Cpu.halt({
                    error      : true,
                    enterDebug : true,
                    message    : "Invalid reg table lookup parameters",
                    decObj     : opcode,
                    regObj     : this._bundleRegisters(),
                    memObj     : this._memoryV
                });
            }
        },

        _setRMValueForOp : function (opcode, value)
        {
            var addr;

            if (0 === opcode.mod)
            {
                switch (opcode.rm)
                {
                    case 0 : // 000b [BX + SI]
                        addr = ( ((this._regBH << 8) | this._regBL) + this._regSI );
                        break;
                    case 1 : // 001b [BX + DI]
                        addr = ( ((this._regBH << 8) | this._regBL) + this._regDI );
                        break;
                    case 2 : // 010b [BP + SI]
                        addr = ( this._regBP + this._regSI );
                        break;
                    case 3 : // 011b [BP + DI]
                        addr = ( this._regBP + this._regDI );
                        break;
                    case 4 : // 100b [SI]
                        addr = ( this._regSI );
                        break;
                    case 5 : // 101b [DI]
                        addr = ( this._regDI );
                        break;
                    case 6 : // 110b Drc't Add
                        // Direct address is always 2 bytes
                        // yoshicapstonememo.googlecode.com/svn/trunk/4_2_86.pdf
                        var addr = ( (this._memoryV[this.segment2absolute(this._regCS, this._regIP + 3)] << 8) |
                                      this._memoryV[this.segment2absolute(this._regCS, this._regIP + 2)] );
                        _tempIP += 2;
                        break;
                    case 7 : // 111b [BX]
                        addr = ( (this._regBH << 8) | this._regBL );
                        break;
                }

                // Set value to memory
                if (0 === opcode.w) // Byte
                {
                    this._memoryV[this.segment2absolute(this._regCS, addr)] = (value & 0x00FF);
                }
                else // Word
                {
                    this._memoryV[this.segment2absolute(this._regCS, addr)]     = (value & 0x00FF);
                    this._memoryV[this.segment2absolute(this._regCS, addr + 1)] = ((value >> 8) & 0x00FF);
                }

            }
            else if (1 === opcode.mod || 2 == opcode.mod)
            {
                var disp;
                if (1 === opcode.mod) {
                    disp = this._memoryV[this.segment2absolute(this._regCS, this._regIP + 2)];
                    _tempIP += 1;
                } else {
                    disp = ( (this._memoryV[this.segment2absolute(this._regCS, this._regIP + 3)] << 8) |
                              this._memoryV[this.segment2absolute(this._regCS, this._regIP + 2)] );
                    _tempIP += 2;
                }

                switch (opcode.rm)
                {
                    case 0 : // [BX + SI]
                        addr = ( ((this._regBH << 8) | this._regBL) + this._regSI + disp );
                        break;
                    case 1 : // [BX + DI]
                        addr = ( ((this._regBH << 8) | this._regBL) + this._regDI + disp );
                        break;
                    case 2 : // [BP + SI]
                        addr = (this._regBP + this._regSI + disp);
                        break;
                    case 3 : // [BP + DI]
                        addr = (this._regBP + this._regDI + disp);
                        break;
                    case 4 : // [SI]
                        addr = (this._regSI + disp);
                        break;
                    case 5 : // [DI]
                        addr = (this._regDI + disp);
                        break;
                    case 6 : // [BP]
                        addr = (this._regBP + disp);
                        break;
                    case 7 : // [BX]
                        addr = ( ((this._regBH << 8) | this._regBL) + disp );
                        break;
                }

                // Set value to memory
                if (0 === opcode.w) // Byte
                {
                    this._memoryV[this.segment2absolute(this._regCS, addr)] = (value & 0x00FF);
                }
                else // Word
                {
                    this._memoryV[this.segment2absolute(this._regCS, addr)]     = (value & 0x00FF);
                    this._memoryV[this.segment2absolute(this._regCS, addr + 1)] = ((value >> 8) & 0x00FF);
                }
            }
            // R/M bits refer to REG tables
            else if (3 === opcode.mod)
            {
                // Modifiy opcode object so reg is now rm. This way we can use existing
                // _getRegValueForOp() method
                this._setRegValueForOp(
                    {w:opcode.w, d:opcode.d, reg:opcode.rm, rm:opcode.rm},
                    value
                );
            }
            else
            {
                if (_breakOnError) _Cpu.halt({
                    error      : true,
                    enterDebug : true,
                    message    : "Invalid r/m table lookup parameters",
                    decObj     : opcode,
                    regObj     : this._bundleRegisters(),
                    memObj     : this._memoryV
                });
            }
        },

        /**
         * Get the amount the IP should increment for an RM operand
         *
         * @param opcode
         * @private
         */
        _getRMIncIP : function (opcode)
        {
            if (0 === opcode.mod)
            {
                if (6 === opcode.rm) // 110b Drc't Add
                {
                    if (0 === opcode.w) // Byte
                    {
                        return 1;
                    }
                    else // Word
                    {
                        return 2;
                    }
                }
            }
            else if (1 === opcode.mod || 2 == opcode.mod)
            {
                return 2;
            }
            return 0;
        },

        /**
         * Configure this cpu instance by saving a reference to the generic
         * CPU emulator and settings. Setup some general flags.
         *
         * @param Cpu
         * @param settings
         * @param Gui
         */
        configure : function (Cpu, settings, Gui)
        {
            _Cpu = Cpu;

            _Gui = Gui;

            _settings = settings;

            _breakOnError = SettingsModel.get("emuSettings").breakOnError;
        },

        /**
         * Create the memory array.
         */
        initializeMemory : function()
        {
            this._memory  = new ArrayBuffer(1048576); // 1,048,576 bytes (1MB)
            this._memoryV = new Uint8Array(this._memory);
        },

        /**
         * Create the ports array.
         */
        initializePorts : function()
        {
            this._ports  = new ArrayBuffer(1048576); // 1,048,576 bytes (1MB)
            this._portsV = new Uint8Array(this._memory);
        },

        /**
         * Reset the registers to the values defined in the settings.
         */
        clearRegisters : function ()
        {
            // Main Registers
            this._regAH = _settings['cpu-init']['registers']['ah'];
            this._regAL = _settings['cpu-init']['registers']['al'];
            this._regBH = _settings['cpu-init']['registers']['bh'];
            this._regBL = _settings['cpu-init']['registers']['bl'];
            this._regCH = _settings['cpu-init']['registers']['ch'];
            this._regCL = _settings['cpu-init']['registers']['cl'];
            this._regDH = _settings['cpu-init']['registers']['dh'];
            this._regDL = _settings['cpu-init']['registers']['dl'];

            this._regSI = _settings['cpu-init']['registers']['si'];;
            this._regDI = _settings['cpu-init']['registers']['di'];;
            this._regBP = _settings['cpu-init']['registers']['bp'];;
            this._regSP = _settings['cpu-init']['registers']['sp'];

            // Program counter
            this._regIP = _settings['cpu-init']['registers']['ip'];

            // Segment registers
            this._regCS = _settings['cpu-init']['registers']['cs'];;
            this._regDS = _settings['cpu-init']['registers']['ds'];;
            this._regES = _settings['cpu-init']['registers']['es'];;
            this._regSS = _settings['cpu-init']['registers']['ss'];;

            // Status register
            this._regFlags = _settings['cpu-init']['registers']['flags'];;

            this._opcode = 0x00;
        },

        /**
         * Initialize the instruction pointer.
         *
         * If an IP is given that value is used, otherwise if the 'use-bios'
         * setting is true the BIOS ROM starting address is used, otherwise
         * the IP value defined in the settings is used.
         *
         * @param (optional) ip
         */
        initIP : function (ip)
        {
            if (ip) {
                this._regIP = ip;
            }
            else if (_settings['use-bios']) {
                this._regIP = this.bios_rom_address;
            }
            else {
                this._regIP = _settings['cpu-init']['registers']['ip'];
            }
        },

        /**
         * Zero out the memory
         */
        clearMemory : function ()
        {
            // Zero memory
            for (var i = 0; i < this._memoryV.length; i++)
            {
                this._memoryV[i] = 0;
            }
        },

        /**
         * Zero out the ports
         */
        clearPorts : function ()
        {
            // Zero ports
            for (var i = 0; i < this._portsV.length; i++)
            {
                this._portsV[i] = 0;
            }
        },

        /**
         * Load the given blob into memory starting at the given address
         *
         * @param addr Start address for the load
         * @param blob Binary data to load
         */
        loadBinary : function (addr, blob)
        {
            if (blob.length > this._memoryV.length)
            {
                throw new EmuExceptions.MemoryBinaryTooLarge(blob.length);
            }
            var av = new Uint8Array(blob);
            this._memoryV.set(av, addr);
        },

        segment2absolute : function (segment, offset)
        {
            // Handle segment overrides
            if (_CS_OVERRIDE) segment = this._regCS;
            else if (_DS_OVERRIDE) segment = this._regDS;
            else if (_ES_OVERRIDE) segment = this._regES;
            else if (_SS_OVERRIDE) segment = this._regSS;
            return (segment * 16) + offset;
        },

        /**
         * Emulate one cpu cycle
         */
        emulateCycle : function ()
        {
            // Some common variables
            var valSrc, valDst, valResult, regX, addr, ipRMInc;

            // Reset IP counter
            _tempIP = 0;

            // Set segment override flags
            _CS_OVERRIDE = false;
            _DS_OVERRIDE = false;
            _ES_OVERRIDE = false;
            _SS_OVERRIDE = false

            // Fetch Opcode
            var opcode_byte  = this._memoryV[this.segment2absolute(this._regCS, this._regIP)];

            // Set segment override flags and fetch another opcode
            if (opcode_byte === 0x26)
            {
                _ES_OVERRIDE = true;
                this._regIP += 1;
                opcode_byte  = this._memoryV[this.segment2absolute(this._regCS, this._regIP)];
            }
            else if (opcode_byte === 0x36) {
                _SS_OVERRIDE = true;
                this._regIP += 1;
                opcode_byte  = this._memoryV[this.segment2absolute(this._regCS, this._regIP)];
            }
            else if (opcode_byte === 0x2E) {
                _CS_OVERRIDE = true;
                this._regIP += 1;
                opcode_byte  = this._memoryV[this.segment2absolute(this._regCS, this._regIP)];
            }
            else if (opcode_byte === 0x3E) {
                _DS_OVERRIDE = true;
                this._regIP += 1;
                opcode_byte  = this._memoryV[this.segment2absolute(this._regCS, this._regIP)];
            }

            // Fetch addressing byte
            var addressing_byte = this._memoryV[this.segment2absolute(this._regCS, this._regIP + 1)];

            //====Decode Opcode====
            var opcode = this._decode(opcode_byte, addressing_byte);

            // Pre-cycle Debug
            if (_Cpu.isDebug())
            {
                _Cpu.debugUpdateDecode(opcode);
                _Cpu.debugUpdateMemory(this._memoryV);
            }

            //====Execute Opcode====
            switch (opcode_byte)
            {
                /**
                 * Two-byte instructions
                 */
                case 0x0F :
                    var opcode_byte_2 = this._memoryV[this.segment2absolute(this._regCS, this._regIP + 1)];
                    if (_breakOnError) _Cpu.halt({
                        error      : true,
                        enterDebug : true,
                        message    : "Two-byte opcode - not supported! [" + opcode_byte_2.toString(16) + "]",
                        decObj     : opcode,
                        regObj     : this._bundleRegisters(),
                        memObj     : this._memoryV
                    });
                    break;

                /**
                 * Instruction : ADC
                 * Meaning     : Add with carry
                 * Notes       : Sums the two operands, if CF is set adds one to the result
                 */
                case 0x10 :
                    valDst = this._getRMValueForOp(opcode);  // E
                    valSrc = this._getRegValueForOp(opcode); // G

                    valResult = valDst + valSrc;
                    if (this._regFlags & this.FLAG_CF_MASK) valResult += 1;

                    // Set clamped byte
                    this._setRMValueForOp(opcode, (valResult & 0x00FF));

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        "b",
                        "add");

                    this._regIP += (_tempIP + 2);

                    break;
                case 0x11 :
                    valDst = this._getRMValueForOp(opcode);  // E
                    valSrc = this._getRegValueForOp(opcode); // G

                    valResult = valDst + valSrc;
                    if (this._regFlags & this.FLAG_CF_MASK) valResult += 1;

                    // Set clamped word
                    this._setRMValueForOp(opcode, (valResult & 0xFFFF));

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        "w",
                        "add");

                    this._regIP += (_tempIP + 2);

                    break;
                case 0x12 :
                    valDst = this._getRegValueForOp(opcode); // G
                    valSrc = this._getRMValueForOp(opcode);  // E

                    valResult = valDst + valSrc;
                    if (this._regFlags & this.FLAG_CF_MASK) valResult += 1;

                    // Set clamped byte
                    this._setRMValueForOp(opcode, (valResult & 0x00FF));

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        "b",
                        "add");

                    this._regIP += (_tempIP + 2);

                    break;
                case 0x13 :
                    valDst = this._getRegValueForOp(opcode); // G
                    valSrc = this._getRMValueForOp(opcode);  // E

                    valResult = valDst + valSrc;
                    if (this._regFlags & this.FLAG_CF_MASK) valResult += 1;

                    // Set clamped word
                    this._setRMValueForOp(opcode, (valResult & 0xFFFF));

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        "w",
                        "add");

                    this._regIP += (_tempIP + 2);

                    break;
                case 0x14 :
                    ipRMInc = this._getRMIncIP(opcode);

                    valDst = this._regAL;
                    valSrc = this._memoryV[this.segment2absolute(this._regCS, this._regIP + ipRMInc + 1)];

                    valResult = valDst + valSrc;
                    if (this._regFlags & this.FLAG_CF_MASK) valResult += 1;

                    // Set clamped byte
                    this._setRMValueForOp(opcode, (valResult & 0x00FF));

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        "b",
                        "add");

                    this._regIP += (_tempIP + 1);

                    break;
                case 0x15 :
                    ipRMInc = this._getRMIncIP(opcode);

                    valDst = ((this._regAH << 8) | this._regAL);
                    valSrc = ((this._memoryV[this.segment2absolute(this._regCS, this._regIP + ipRMInc + 2)] << 8) |
                               this._memoryV[this.segment2absolute(this._regCS, this._regIP + ipRMInc + 1)]);

                    valResult = valDst + valSrc;
                    if (this._regFlags & this.FLAG_CF_MASK) valResult += 1;

                    // Set clamped word
                    this._setRMValueForOp(opcode, (valResult & 0xFFFF));

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        "w",
                        "add");

                    this._regIP += (_tempIP + 1);

                    break;

                /**
                 * Instruction : ADD
                 * Meaning     : Add src to dst replacing the original contents
                 *               of dest
                 * Notes       :
                 */
                case 0x00:
                    valDst = this._getRMValueForOp(opcode);  // E
                    valSrc = this._getRegValueForOp(opcode); // G

                    valResult = valDst + valSrc;

                    this._setRMValueForOp(opcode, valResult & 0x00FF);

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        "b",
                        "add");

                    this._regIP += (_tempIP + 2);

                    break;
                case 0x01:
                    valDst = this._getRMValueForOp(opcode);  // E
                    valSrc = this._getRegValueForOp(opcode); // G

                    valResult = valDst + valSrc;

                    this._setRMValueForOp(opcode, valResult & 0xFFFF);

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        "w",
                        "add");

                    this._regIP += (_tempIP + 2);

                    break;
                case 0x02:
                    valDst = this._getRegValueForOp(opcode); // G
                    valSrc = this._getRMValueForOp(opcode);  // E

                    valResult = valDst + valSrc;

                    this._setRegValueForOp(opcode, valResult & 0x00FF);

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        "b",
                        "add");

                    this._regIP += (_tempIP + 2);

                    break;
                case 0x03:
                    valDst = this._getRegValueForOp(opcode); // G
                    valSrc = this._getRMValueForOp(opcode);  // E

                    valResult = valDst + valSrc;

                    this._setRMValueForOp(opcode, valResult & 0xFFFF);

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        "w",
                        "add");

                    this._regIP += (_tempIP + 2);

                    break;

                case 0x04:
                    valDst = this._regAL;
                    valSrc = this._memoryV[this.segment2absolute(this._regCS, this._regIP + 1)];

                    valResult = valDst + valSrc;

                    this._regAL = valResult & 0x00FF;

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        "b",
                        "add");

                    this._regIP += 2;

                    break;
                case 0x05:
                    valDst = ((this._regAH << 8) | this._regAL);
                    valSrc = ((this._memoryV[this.segment2absolute(this._regCS, this._regIP + 2)] << 8) |
                               this._memoryV[this.segment2absolute(this._regCS, this._regIP + 1)]);

                    valResult = valDst + valSrc;

                    this._regAH = (valResult & 0xFF00) >> 8;
                    this._regAL = (valResult & 0x00FF);

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        "w",
                        "add");

                    this._regIP += (_tempIP + 1);

                    break;

                /**
                 * Instruction : AND
                 * Meaning     : Logical and
                 * Notes       :
                 */
                case 0x20:
                    valDst = this._getRMValueForOp(opcode);  // E
                    valSrc = this._getRegValueForOp(opcode); // G

                    valResult = valDst & valSrc;

                    this._setRMValueForOp(opcode, valResult & 0x00FF);

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        "b",
                        "add");

                    this._regIP += (_tempIP + 2);

                    break;
                case 0x21:
                    valDst = this._getRMValueForOp(opcode);  // E
                    valSrc = this._getRegValueForOp(opcode); // G

                    valResult = valDst & valSrc;

                    this._setRMValueForOp(opcode, valResult & 0xFFFF);

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        "w",
                        "add");

                    this._regIP += (_tempIP + 2);

                    break;
                case 0x22:
                    valDst = this._getRegValueForOp(opcode); // G
                    valSrc = this._getRMValueForOp(opcode);  // E

                    valResult = valDst & valSrc;

                    this._setRegValueForOp(opcode, valResult & 0x00FF);

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        "b",
                        "add");

                    this._regIP += (_tempIP + 2);

                    break;
                case 0x23:
                    valDst = this._getRegValueForOp(opcode); // G
                    valSrc = this._getRMValueForOp(opcode);  // E

                    valResult = valDst & valSrc;

                    this._setRMValueForOp(opcode, valResult & 0xFFFF);

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        "w",
                        "add");

                    this._regIP += (_tempIP + 2);

                    break;

                case 0x24:
                    valDst = this._regAL;
                    valSrc = this._memoryV[this.segment2absolute(this._regCS, this._regIP + 1)];

                    valResult = valDst & valSrc;

                    this._regAL = valResult & 0x00FF;

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        "b",
                        "add");

                    this._regIP += 1;

                    break;
                case 0x25:
                    valDst = ((this._regAH << 8) | this._regAL);
                    valSrc = ((this._memoryV[this.segment2absolute(this._regCS, this._regIP + 2)] << 8) |
                               this._memoryV[this.segment2absolute(this._regCS, this._regIP + 1)]);

                    valResult = valDst & valSrc;

                    this._regAH = (valResult & 0xFF00) >> 8;
                    this._regAL = (valResult & 0x00FF);

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        "w",
                        "add");

                    this._regIP += (_tempIP + 1);

                    break;

                /**
                 * Instruction : CALL
                 * Meaning     : Transfers control to procedure, return address is
                 *              (IP) is pushed to stack.
                 * Notes       :
                 */
                case 0xE8:
                    // Push return address
                    // The return address is the _NEXT_ instruction, not the current
                    this._push(this._regIP + 3);

                    // The jump address is a signed (twos complement) offset from the
                    // current location.
                    var offset = ((this._memoryV[this.segment2absolute(this._regCS, this._regIP + 2)] << 8) |
                                   this._memoryV[this.segment2absolute(this._regCS, this._regIP + 1)]);

                    // two-byte twos-complement conversion
                    offset = ((offset >> 15) === 1) ? (-1 * (offset >> 15)) * ((offset ^ 0xFFFF) + 1) : offset;

                    // We must skip the last byte of this instruction
                    this._regIP += (offset + 3);

                    break;

                /**
                 * Instruction : CLC
                 * Meaning     : Clear Carry flag.
                 * Notes       :
                 */
                case 0xF8:
                    this._regFlags &= ~this.FLAG_CF_MASK;
                    this._regIP += 1;
                    break;

                /**
                 * Instruction : CLI
                 * Meaning     : Clear Interrupt flag.
                 * Notes       :
                 */
                case 0xFA:
                    this._regFlags &= ~this.FLAG_IF_MASK;
                    this._regIP += 1;
                    break;

                /**
                 * Instruction : CLD
                 * Meaning     : Clear Direction flag.
                 * Notes       :
                 */
                case 0xFC:
                    this._regFlags &= ~this.FLAG_DF_MASK;
                    this._regIP += 1;
                    break;

                /**
                 * Instruction : CMP
                 * Meaning     :
                 * Notes       :
                 */
                case 0x38:
                    valDst = this._getRMValueForOp(opcode);  // E
                    valSrc = this._getRegValueForOp(opcode); // G

                    valResult = valDst - valSrc;

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        "b",
                        "sub");

                    this._regIP += (_tempIP + 2);

                    break;
                case 0x39:
                    valDst = this._getRMValueForOp(opcode);  // E
                    valSrc = this._getRegValueForOp(opcode); // G

                    valResult = valDst - valSrc;

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        "w",
                        "sub");

                    this._regIP += (_tempIP + 2);

                    break;
                case 0x3A:
                    valDst = this._getRegValueForOp(opcode); // G
                    valSrc = this._getRMValueForOp(opcode);  // E

                    valResult = valDst - valSrc;

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        "b",
                        "sub");

                    this._regIP += (_tempIP + 2);

                    break;
                case 0x3B:
                    valDst = this._getRegValueForOp(opcode); // G
                    valSrc = this._getRMValueForOp(opcode);  // E

                    valResult = valDst - valSrc;

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        "b",
                        "sub");

                    this._regIP += (_tempIP + 2);

                    break;
                case 0x3C:
                    valDst = this._regAL;
                    valSrc = this._memoryV[this.segment2absolute(this._regCS, this._regIP + 1)];

                    valResult = valDst - valSrc;

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        "b",
                        "sub");

                    this._regIP += 2;

                    break;
                case 0x3D:
                    valDst = ((this._regAH << 8) | this._regAL);
                    valSrc = ((this._memoryV[this.segment2absolute(this._regCS, this._regIP + 2)] << 8) |
                               this._memoryV[this.segment2absolute(this._regCS, this._regIP + 1)]);

                    valResult = valDst - valSrc;

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        "w",
                        "sub");

                    this._regIP += 3;

                    break;

                /**
                 * Instruction : DEC
                 * Meaning     : Decrement by 1
                 * Notes       :
                 */
                case 0x48 :
                    regX = ((this._regAH << 8) | this._regAL);

                    valResult = regX - 1;

                    // Handle underflow correctly
                    if (valResult < 0)
                    {
                        valResult = 0xFFFF + 1 + valResult;
                    }

                    this._regAH = (valResult & 0xFF00) >> 8;
                    this._regAL = (valResult & 0x00FF);

                    this._setFlags(
                        regX,
                        1,
                        valResult,
                        (   this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        'w',
                        "sub");

                    this._regIP += 1;

                    break;
                case 0x49 :
                    regX = ((this._regCH << 8) | this._regCL);

                    valResult = regX - 1;

                    // Handle underflow correctly
                    if (valResult < 0)
                    {
                        valResult = 0xFFFF + 1 + valResult;
                    }

                    this._regCH = (valResult & 0xFF00) >> 8;
                    this._regCL = (valResult & 0x00FF);

                    this._setFlags(
                        regX,
                        1,
                        valResult,
                        (   this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        'w',
                        "sub");

                    this._regIP += 1;

                    break;
                case 0x4A :
                    regX = ((this._regDH << 8) | this._regDL);

                    valResult = regX - 1;

                    // Handle underflow correctly
                    if (valResult < 0)
                    {
                        valResult = 0xFFFF + 1 + valResult;
                    }

                    this._regDH = (valResult & 0xFF00) >> 8;
                    this._regDL = (valResult & 0x00FF);

                    this._setFlags(
                        regX,
                        1,
                        valResult,
                        (   this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        'w',
                        "sub");

                    this._regIP += 1;

                    break;
                case 0x4B :
                    regX = ((this._regBH << 8) | this._regBL);

                    valResult = regX - 1;

                    // Handle underflow correctly
                    if (valResult < 0)
                    {
                        valResult = 0xFFFF + 1 + valResult;
                    }

                    this._regBH = (valResult & 0xFF00) >> 8;
                    this._regBL = (valResult & 0x00FF);

                    this._setFlags(
                        regX,
                        1,
                        valResult,
                        (   this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        'w',
                        "sub");

                    this._regIP += 1;

                    break;
                case 0x4C :
                    regX = this._regSP;

                    valResult = regX - 1;

                    // Handle underflow correctly
                    if (valResult < 0)
                    {
                        valResult = 0xFFFF + 1 + valResult;
                    }

                    this._regSP = (valResult & 0xFFFF);

                    this._setFlags(
                        regX,
                        1,
                        valResult,
                        (   this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        'w',
                        "sub");

                    this._regIP += 1;

                    break;
                case 0x4D :
                    regX = this._regBP;

                    valResult = regX - 1;

                    // Handle underflow correctly
                    if (valResult < 0)
                    {
                        valResult = 0xFFFF + 1 + valResult;
                    }

                    this._regBP = (valResult & 0xFFFF);

                    this._setFlags(
                        regX,
                        1,
                        valResult,
                        (   this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        'w',
                        "sub");

                    this._regIP += 1;

                    break;
                case 0x4E :
                    regX = this._regSI;

                    valResult = regX - 1;

                    // Handle underflow correctly
                    if (valResult < 0)
                    {
                        valResult = 0xFFFF + 1 + valResult;
                    }

                    this._regSI = (valResult & 0xFFFF);

                    this._setFlags(
                        regX,
                        1,
                        valResult,
                        (   this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        'w',
                        "sub");

                    this._regIP += 1;

                    break;
                case 0x4F :
                    regX = this._regDI;

                    valResult = regX - 1;

                    // Handle underflow correctly
                    if (valResult < 0)
                    {
                        valResult = 0xFFFF + 1 + valResult;
                    }

                    this._regDI = (valResult & 0xFFFF);

                    this._setFlags(
                        regX,
                        1,
                        valResult,
                        (   this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        'w',
                        "sub");

                    this._regIP += 1;

                    break;

                /**
                 * Instruction : GRP1
                 * Meaning     : Group Opcode 1
                 * Notes       :
                 */
                case 0x80:
                case 0x81:
                case 0x82:
                case 0x83:
                    // Group opcodes use R/M to determine register (REG is used to determine
                    // instruction)
                    valDst = this._getRMValueForOp({mod: opcode.mod, w:opcode.w, d:opcode.d, reg:opcode.rm, rm:opcode.rm});
                    var clampMask;
                    var size;
                    ipRMInc = this._getRMIncIP(opcode);

                    if (0x80 === opcode_byte)
                    {
                        valSrc = (this._memoryV[this.segment2absolute(this._regCS, this._regIP + ipRMInc + 3)]);

                        // Clamp source to byte
                        valSrc = valSrc & 0x00FF;

                        // Clamp value to byte
                        clampMask = 0x00FF;

                        size = "b";

                        _tempIP += 1;
                    }
                    else if (0x81 === opcode_byte)
                    {
                        valSrc = ((this._memoryV[this.segment2absolute(this._regCS, this._regIP + ipRMInc + 3)] << 8) |
                                   this._memoryV[this.segment2absolute(this._regCS, this._regIP + ipRMInc + 2)]);

                        // Clamp value to word
                        clampMask = 0xFFFF;

                        size = "w";

                        _tempIP += 2;
                    }
                    else if (0x82 === opcode_byte)
                    {
                        valSrc = ((this._memoryV[this.segment2absolute(this._regCS, this._regIP + ipRMInc + 3)] << 8) |
                                   this._memoryV[this.segment2absolute(this._regCS, this._regIP + ipRMInc + 2)]);

                        // Clamp source to byte
                        valSrc = valSrc & 0x00FF;

                        // Clamp value to byte
                        clampMask = 0x00FF;

                        size = "b";

                        _tempIP += 1;
                    }
                    else if (0x83 === opcode_byte)
                    {
                        valSrc = this._memoryV[this.segment2absolute(this._regCS, this._regIP + ipRMInc + 2)];

                        // Clamp source to byte
                        valSrc = valSrc & 0x00FF;

                        // Clamp value to word
                        clampMask = 0xFFFF;

                        size = "w";

                        // Sign extend to word
                        if ( 1 === ( (valSrc & 0x80) >> 7)) valSrc = 0xFF00 | valSrc;

                        _tempIP += 1;
                    }

                    switch (opcode.reg) {
                        /**
                         * Instruction : ADD
                         * Meaning     : Add src to dst replacing the original contents
                         *               of dest
                         * Notes       :
                         */
                        case 0 :
                            valResult = valDst + valSrc;

                            // Set clamped word
                            this._setRMValueForOp(opcode, (valResult & clampMask));

                            // correct for direct addressing IP counting
                            if ( (0 === opcode.mod && 6 === opcode.rm) ||
                                 (1 === opcode.mod || 2 === opcode.mod) )
                            {
                                _tempIP -= 2;
                            }

                            this._setFlags(
                                valDst,
                                valSrc,
                                valResult,
                                (   this.FLAG_CF_MASK |
                                    this.FLAG_ZF_MASK |
                                    this.FLAG_SF_MASK |
                                    this.FLAG_OF_MASK |
                                    this.FLAG_PF_MASK |
                                    this.FLAG_AF_MASK),
                                size,
                                "add");

                            this._regIP += (_tempIP + 2);

                            break;

                        /**
                         * Instruction : OR
                         * Meaning     : Logical inclusive or of the operands
                         * Notes       :
                         */
                        case 1 :
                            valResult = (valDst || valSrc);

                            // Set clamped word
                            this._setRMValueForOp(opcode, (valResult & clampMask));

                            // correct for direct addressing IP counting
                            if ( (0 === opcode.mod && 6 === opcode.rm) ||
                                 (1 === opcode.mod || 2 === opcode.mod) )
                            {
                                _tempIP -= 2;
                            }

                            this._setFlags(
                                valDst,
                                valSrc,
                                valResult,
                                (   this.FLAG_CF_MASK |
                                    this.FLAG_ZF_MASK |
                                    this.FLAG_SF_MASK |
                                    this.FLAG_OF_MASK |
                                    this.FLAG_PF_MASK |
                                    this.FLAG_AF_MASK),
                                size,
                                "add");

                            this._regIP += (_tempIP + 2);

                            break;

                        /**
                         * Instruction : ADC
                         * Meaning     : Add with carry
                         * Notes       : Sums the two operands, if CF is set adds one to the result
                         */
                        case 2 :
                            valResult = valDst + valSrc;
                            if (this._regFlags & this.FLAG_CF_MASK) valResult += 1;

                            // Set clamped word
                            this._setRMValueForOp(opcode, (valResult & clampMask));

                            // correct for direct addressing IP counting
                            if ( (0 === opcode.mod && 6 === opcode.rm) ||
                                 (1 === opcode.mod || 2 === opcode.mod) )
                            {
                                _tempIP -= 2;
                            }

                            this._setFlags(
                                valDst,
                                valSrc,
                                valResult,
                                (   this.FLAG_CF_MASK |
                                    this.FLAG_ZF_MASK |
                                    this.FLAG_SF_MASK |
                                    this.FLAG_OF_MASK |
                                    this.FLAG_PF_MASK |
                                    this.FLAG_AF_MASK),
                                size,
                                "add");

                            this._regIP += (_tempIP + 2);

                            break;

                        /**
                         * Instruction : SBB
                         * Meaning     : Subtract with borrow
                         * Notes       : Subtracts the two operands, if CF is set subtracts
                         *               one from the result
                         */
                        case 3 :
                            valResult = valDst - valSrc;
                            if (this._regFlags & this.FLAG_CF_MASK) valResult -= 1;

                            // Handle underflow correctly
                            if (valResult < 0)
                            {
                                if ("b" === size) valResult = 0x00FF + 1 + valResult;
                                else if ("w" === size) valResult = 0xFFFF + 1 + valResult;
                            }

                            // Set clamped word
                            this._setRMValueForOp(opcode, (valResult & clampMask));

                            // correct for direct addressing IP counting
                            if ( (0 === opcode.mod && 6 === opcode.rm) ||
                                 (1 === opcode.mod || 2 === opcode.mod) )
                            {
                                _tempIP -= 2;
                            }

                            this._setFlags(
                                valDst,
                                valSrc,
                                valResult,
                                (   this.FLAG_CF_MASK |
                                    this.FLAG_ZF_MASK |
                                    this.FLAG_SF_MASK |
                                    this.FLAG_OF_MASK |
                                    this.FLAG_PF_MASK |
                                    this.FLAG_AF_MASK),
                                size,
                                "sub");

                            this._regIP += (_tempIP + 2);

                            break;
                        /**
                         * Instruction : AND
                         * Meaning     : Logical AND
                         * Notes       :
                         */
                        case 4 :
                            valResult = valDst & valSrc;

                            // Set clamped word
                            this._setRMValueForOp(opcode, (valResult & clampMask));

                            // correct for direct addressing IP counting
                            if ( (0 === opcode.mod && 6 === opcode.rm) ||
                                 (1 === opcode.mod || 2 === opcode.mod) )
                            {
                                _tempIP -= 2;
                            }

                            this._setFlags(
                                valDst,
                                valSrc,
                                valResult,
                                (   this.FLAG_CF_MASK |
                                    this.FLAG_ZF_MASK |
                                    this.FLAG_SF_MASK |
                                    this.FLAG_OF_MASK |
                                    this.FLAG_PF_MASK |
                                    this.FLAG_AF_MASK),
                                size,
                                "add");

                            this._regIP += (_tempIP + 2);
                            break;
                        /**
                         * Instruction : SUB
                         * Meaning     : Subtract
                         * Notes       : The source is subtracted from the destination and
                         *               the result is stored in the destination
                         */
                        case 5 :
                            valResult = valDst - valSrc;

                            // Handle underflow correctly
                            if (valResult < 0)
                            {
                                if ("b" === size) valResult = 0x00FF + 1 + valResult;
                                else if ("w" === size) valResult = 0xFFFF + 1 + valResult;
                            }

                            // Set clamped word
                            this._setRMValueForOp(opcode, (valResult & clampMask));

                            // correct for direct addressing IP counting
                            if ( (0 === opcode.mod && 6 === opcode.rm) ||
                                 (1 === opcode.mod || 2 === opcode.mod) )
                            {
                                _tempIP -= 2;
                            }

                            this._setFlags(
                                valDst,
                                valSrc,
                                valResult,
                                (   this.FLAG_CF_MASK |
                                    this.FLAG_ZF_MASK |
                                    this.FLAG_SF_MASK |
                                    this.FLAG_OF_MASK |
                                    this.FLAG_PF_MASK |
                                    this.FLAG_AF_MASK),
                                size,
                                "add");

                            this._regIP += (_tempIP + 2);
                            break;

                        /**
                         * Instruction : XOR
                         * Meaning     : Performs a bitwise exclusive or of the operands.
                         * Notes       :
                         */
                        case 6 :
                            valResult = (valDst ^ valSrc);

                            // Set clamped word
                            this._setRMValueForOp(opcode, (valResult & clampMask));

                            // correct for direct addressing IP counting
                            if ( (0 === opcode.mod && 6 === opcode.rm) ||
                                 (1 === opcode.mod || 2 === opcode.mod) )
                            {
                                _tempIP -= 2;
                            }

                            this._setFlags(
                                valDst,
                                valSrc,
                                valResult,
                                (   this.FLAG_CF_MASK |
                                    this.FLAG_ZF_MASK |
                                    this.FLAG_SF_MASK |
                                    this.FLAG_OF_MASK |
                                    this.FLAG_PF_MASK |
                                    this.FLAG_AF_MASK),
                                size,
                                "or");

                            this._regIP += (_tempIP + 2);
                            break;
                        /**
                         * Instruction : CMP
                         * Meaning     : Compare
                         * Notes       :
                         */
                        case 7 :
                            valResult = valDst - valSrc;

                            this._setFlags(
                                valDst,
                                valSrc,
                                valResult,
                                (   this.FLAG_CF_MASK |
                                    this.FLAG_ZF_MASK |
                                    this.FLAG_SF_MASK |
                                    this.FLAG_OF_MASK |
                                    this.FLAG_PF_MASK |
                                    this.FLAG_AF_MASK),
                                size,
                                "sub");

                            this._regIP += (_tempIP + 2);

                            break;
                        default :
                            if (_breakOnError) _Cpu.halt({
                                error      : true,
                                enterDebug : true,
                                message    : "Invalid opcode!",
                                decObj     : opcode,
                                regObj     : this._bundleRegisters(),
                                memObj     : this._memoryV
                            });
                    }
                    break;

                /**
                 * Instruction : GRP4
                 * Meaning     : Group Opcode 4
                 * Notes       :
                 */
                case 0xFE:
                    switch (opcode.reg) {
                        /**
                         * Instruction : INC
                         * Meaning     : Increment by 1
                         * Notes       :
                         */
                        case 0 :
                            valDst = this._getRMValueForOp(opcode);  // E

                            valResult = (valDst + 1) & 0x00FF;

                            this._setRMValueForOp(opcode, valResult);

                            this._setFlags(
                                regX,
                                1,
                                valResult,
                                (   this.FLAG_ZF_MASK |
                                    this.FLAG_SF_MASK |
                                    this.FLAG_OF_MASK |
                                    this.FLAG_PF_MASK |
                                    this.FLAG_AF_MASK),
                                'b',
                                "add");

                            this._regIP += 2;

                            break;
                        /**
                         * Instruction : DEC
                         * Meaning     : Decrement by 1
                         * Notes       :
                         */
                        case 1 :
                            valDst = this._getRMValueForOp(opcode);  // E

                            valResult = (valDst - 1) & 0x00FF;

                            // Handle underflow correctly
                            if (valResult < 0)
                            {
                                if ("b" === size) valResult = 0x00FF + 1 + valResult;
                                else if ("w" === size) valResult = 0xFFFF + 1 + valResult;
                            }

                            this._setRMValueForOp(opcode, valResult);

                            this._setFlags(
                                regX,
                                1,
                                valResult,
                                (   this.FLAG_ZF_MASK |
                                    this.FLAG_SF_MASK |
                                    this.FLAG_OF_MASK |
                                    this.FLAG_PF_MASK |
                                    this.FLAG_AF_MASK),
                                'b',
                                "seb");

                            this._regIP += 2;

                            break;
                        default :
                            if (_breakOnError) _Cpu.halt({
                                error      : true,
                                enterDebug : true,
                                message    : "Invalid opcode!",
                                decObj     : opcode,
                                regObj     : this._bundleRegisters(),
                                memObj     : this._memoryV
                            });
                    }

                    break;
                /**
                 * Instruction : GRP5
                 * Meaning     : Group Opcode 5
                 * Notes       :
                 */
                case 0xFF:
                    if (_breakOnError) _Cpu.halt({
                        error      : true,
                        enterDebug : true,
                        message    : "[c:" + _Cpu._cycles + "] Opcode not implemented! [0x" + opcode_byte.toString(16) + "]",
                        decObj     : opcode,
                        regObj     : this._bundleRegisters(),
                        memObj     : this._memoryV
                    });
                    break;

                /**
                 * Instruction : HLT
                 * Meaning     : Halt the System
                 * Notes       :
                 */
                case 0xF4:
                    //this.halt = true;
                    //_Cpu._haltFlag = false;
                    _Cpu.halt({
                        error      : false,
                        enterDebug : true,
                        message    : "Program halted",
                        decObj     : opcode,
                        regObj     : this._bundleRegisters(),
                        memObj     : this._memoryV
                    });
                    break;

                /**
                 * Instruction : INC
                 * Meaning     : Increment by 1
                 * Notes       :
                 */
                case 0x40 :
                    regX = ((this._regAH << 8) | this._regAL);
                    valResult = (regX + 1) & 0xFFFF; // Clamp to word
                    this._regAH = (valResult & 0xFF00) >> 8;
                    this._regAL = (valResult & 0x00FF);

                    this._setFlags(
                        regX,
                        1,
                        valResult,
                        (   this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        'w',
                        "add");

                    this._regIP += 1;

                    break;
                case 0x41 :
                    regX = ((this._regCH << 8) | this._regCL);
                    valResult = (regX + 1) & 0xFFFF; // Clamp to word
                    this._regCH = (valResult & 0xFF00) >> 8;
                    this._regCL = (valResult & 0x00FF);

                    this._setFlags(
                        regX,
                        1,
                        valResult,
                        (   this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        'w',
                        "add");

                    this._regIP += 1;

                    break;
                case 0x42 :
                    regX = ((this._regDH << 8) | this._regDL);
                    valResult = (regX + 1) & 0xFFFF; // Clamp to word
                    this._regDH = (valResult & 0xFF00) >> 8;
                    this._regDL = (valResult & 0x00FF);

                    this._setFlags(
                        regX,
                        1,
                        valResult,
                        (   this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        'w',
                        "add");

                    this._regIP += 1;

                    break;
                case 0x43 :
                    regX = ((this._regBH << 8) | this._regBL);
                    valResult = (regX + 1) & 0xFFFF; // Clamp to word
                    this._regBH = (valResult & 0xFF00) >> 8;
                    this._regBL = (valResult & 0x00FF);

                    this._setFlags(
                        regX,
                        1,
                        valResult,
                        (   this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        'w',
                        "add");

                    this._regIP += 1;

                    break;
                case 0x44 :
                    regX = this._regSP;
                    valResult = (regX + 1) & 0xFFFF; // Clamp to word
                    this._regSP = valResult;

                    this._setFlags(
                        regX,
                        1,
                        valResult,
                        (   this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        'w',
                        "add");

                    this._regIP += 1;

                    break;
                case 0x45 :
                    regX = this._regBP;
                    valResult = (regX + 1) & 0xFFFF; // Clamp to word
                    this._regBP = valResult;

                    this._setFlags(
                        regX,
                        1,
                        valResult,
                        (   this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        'w',
                        "add");

                    this._regIP += 1;

                    break;
                case 0x46 :
                    regX = this._regSI;
                    valResult = (regX + 1) & 0xFFFF; // Clamp to word
                    this._regSI = valResult;

                    this._setFlags(
                        regX,
                        1,
                        valResult,
                        (   this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        'w',
                        "add");

                    this._regIP += 1;

                    break;
                case 0x47 :
                    regX = this._regDI;
                    valResult = (regX + 1) & 0xFFFF; // Clamp to word
                    this._regDI = valResult;

                    this._setFlags(
                        regX,
                        1,
                        valResult,
                        (   this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        'w',
                        "add");

                    this._regIP += 1;

                    break;

                /**
                 * Instruction : INT
                 * Meaning     : Interrupt
                 * Notes       : Initiates a software interrupt by pushing the
                 *               flags, clearing the Trap and Interrupt Flags,
                 *               pushing CS followed by IP and loading CS:IP
                 *               with the value found in the interrupt vector
                 *               table. Execution then begins at the location
                 *               addressed by the new CS:IP
                 */
                case 0xCC:
                    if (_breakOnError) _Cpu.halt({
                        error      : true,
                        enterDebug : true,
                        message    : "[c:" + _Cpu._cycles + "] Opcode not implemented! [0x" + opcode_byte.toString(16) + "]",
                        decObj     : opcode,
                        regObj     : this._bundleRegisters(),
                        memObj     : this._memoryV
                    });
                    break;
                case 0xCD:
                    // Push flags
                    this._push(this._regFlags);

                    // Clear trap and interrupt flags
                    this._regFlags &= ~this.FLAG_TF_MASK;
                    this._regFlags &= ~this.FLAG_IF_MASK;

                    // Push CS
                    this._push(this._regCS);

                    // Push IP
                    this._push(this._regIP);

                    // Run BIOS procedure
                    // TODO: Make this work with a real BIOS
                    this.tmpBios.INT10h(this, _Cpu);

                    // Pop IP
                    this._regIP = this._pop();

                    // Pop CS
                    this._regCS = this._pop();

                    // Pop flags
                    this._regFlags = this._pop();

                    this._regIP += 2;

                    break;

                /**
                 * Instruction : JMP
                 * Meaning     : Unconditional jump
                 * Notes       : Unconditionally transfers control to "label"
                 */
                case 0xEB:
                    this._shortJump();
                    break;

                /**
                 * Instruction : JO
                 * Meaning     : Short Jump on overflow
                 * Notes       :
                 */
                case 0x70:
                    if ( 1 <= (this._regFlags & this.FLAG_OF_MASK) )
                    {
                        this._shortJump();
                    }
                    else
                    {
                        this._regIP += 2;
                    }
                    break;

                /**
                 * Instruction : JNO
                 * Meaning     : Short Jump if Not Overflow.
                 * Notes       :
                 */
                case 0x71:
                    if ( 0 === (this._regFlags & this.FLAG_OF_MASK) )
                    {
                        this._shortJump();
                    }
                    else
                    {
                        this._regIP += 2;
                    }
                    break;

                /**
                 * Instruction : JB / JNAE
                 * Meaning     : Short Jump Below / Short Jump Above or Equal.
                 * Notes       :
                 */
                case 0x72:
                    if ( 1 <= (this._regFlags & this.FLAG_CF_MASK) )
                    {
                        this._shortJump();
                    }
                    else
                    {
                        this._regIP += 2;
                    }
                    break;

                /**
                 * Instruction : JNB / JAE
                 * Meaning     : Short Jump on Not Below / Short Jump Above or Equal.
                 * Notes       :
                 */
                case 0x73:
                    if ( 0 === (this._regFlags & this.FLAG_CF_MASK) )
                    {
                        this._shortJump();
                    }
                    else
                    {
                        this._regIP += 2;
                    }
                    break;

                /**
                 * Instruction : JZ / JE
                 * Meaning     : Short Jump if Zero (equal).
                 * Notes       : TESTED!
                 */
                case 0x74:
                    if ( 1 <= (this._regFlags & this.FLAG_ZF_MASK) )
                    {
                        this._shortJump();
                    }
                    else
                    {
                        this._regIP += 2;
                    }
                    break;

                /**
                 * Instruction : JNZ / JNE
                 * Meaning     : Short Jump Not Zero / Short Jump Not Equal.
                 * Notes       :
                 */
                case 0x75:
                    if (0 === (this._regFlags & this.FLAG_ZF_MASK))
                    {
                        this._shortJump();
                    }
                    else
                    {
                        this._regIP += 2;
                    }
                    break;

                /**
                 * Instruction : JBE / JNA
                 * Meaning     : Short Jump Below or Equal / Short Jump Not Above.
                 * Notes       :
                 */
                case 0x76:
                    if ( 1 <= (this._regFlags & this.FLAG_CF_MASK) ||
                         1 <= (this._regFlags & this.FLAG_ZF_MASK) )
                    {
                        this._shortJump();
                    }
                    else
                    {
                        this._regIP += 2;
                    }
                    break;

                /**
                 * Instruction : JA / JNBE
                 * Meaning     : Short Jump Below or Equal / Short Jump Not Above.
                 * Notes       :
                 */
                case 0x77:
                    if ( 0 === (this._regFlags & this.FLAG_CF_MASK) &&
                         0 === (this._regFlags & this.FLAG_ZF_MASK) )
                    {
                        this._shortJump();
                    }
                    else
                    {
                        this._regIP += 2;
                    }
                    break;

                /**
                 * Instruction : JS
                 * Meaning     : Short Jump Signed
                 * Notes       :
                 */
                case 0x78:
                    if ( 1 <= ( this._regFlags & this.FLAG_SF_MASK) )
                    {
                        this._shortJump();
                    }
                    else
                    {
                        this._regIP += 2;
                    }
                    break;

                /**
                 * Instruction : JNS
                 * Meaning     : Short Jump Not Signed
                 * Notes       :
                 */
                case 0x79:
                    if ( 0 === ( this._regFlags & this.FLAG_SF_MASK) )
                    {
                        this._shortJump();
                    }
                    else
                    {
                        this._regIP += 2;
                    }
                    break;

                /**
                 * Instruction : JPE / JP
                 * Meaning     : Short Jump on Parity Even / Short Jump on Parity
                 * Notes       :
                 */
                case 0x7A:
                    if ( 1 <= ( this._regFlags & this.FLAG_PF_MASK) )
                    {
                        this._shortJump();
                    }
                    else
                    {
                        this._regIP += 2;
                    }
                    break;

                /**
                 * Instruction : JPO / JNP
                 * Meaning     : Short Jump on Parity Odd / Short Jump Not Parity
                 * Notes       :
                 */
                case 0x7B:
                    if ( 0 === ( this._regFlags & this.FLAG_PF_MASK) )
                    {
                        this._shortJump();
                    }
                    else
                    {
                        this._regIP += 2;
                    }
                    break;

                /**
                 * Instruction : JL / JNGE
                 * Meaning     : Short Jump Less / Short Jump Not Greater or Equal
                 * Notes       :
                 */
                case 0x7C:
                    if ( ( 0 === this._regFlags & this.FLAG_SF_MASK &&
                           1 <=  this._regFlags & this.FLAG_OF_MASK ) ||
                         ( 1 <= this._regFlags & this.FLAG_SF_MASK &&
                           0 === this._regFlags & this.FLAG_OF_MASK ) )
                    {
                        this._shortJump();
                    }
                    else
                    {
                        this._regIP += 2;
                    }
                    break;

                /**
                 * Instruction : JGE / JNL
                 * Meaning     : Short Jump Greater or Equal / Short Jump Not Less
                 * Notes       :
                 */
                case 0x7D:
                    //if ( this._regFlags & this.FLAG_SF_MASK === this._regFlags & this.FLAG_OF_MASK )
                    if ( ( 1 <=  this._regFlags & this.FLAG_SF_MASK ||
                           0 === this._regFlags & this.FLAG_OF_MASK ) &&
                         ( 0 === this._regFlags & this.FLAG_SF_MASK ||
                           1 <=  this._regFlags & this.FLAG_OF_MASK ) )
                    {
                        this._shortJump();
                    }
                    else
                    {
                        this._regIP += 2;
                    }
                    break;

                /**
                 * Instruction : JLE / JNG
                 * Meaning     : Short Jump Less or Equal / Short Jump Not Greater
                 * Notes       :
                 */
                case 0x7E:
                    if ( 1 <= this._regFlags & this.FLAG_ZF_MASK ||
                         ( ( 0 === this._regFlags & this.FLAG_SF_MASK &&
                             1 <=  this._regFlags & this.FLAG_OF_MASK ) ||
                           ( 1 <=  this._regFlags & this.FLAG_SF_MASK &&
                             0 === this._regFlags & this.FLAG_OF_MASK ) ) )
                    {
                        this._shortJump();
                    }
                    else
                    {
                        this._regIP += 2;
                    }
                    break;

                /**
                 * Instruction : JG / JNLE
                 * Meaning     : Short Jump Greater / Short Jump Not Less or Equal
                 * Notes       :
                 */
                case 0x7F:
                    if ( 0 === (this._regFlags & this.FLAG_ZF_MASK) &&
                         ( ( 1 <=  this._regFlags & this.FLAG_SF_MASK ||
                             0 === this._regFlags & this.FLAG_OF_MASK ) &&
                           ( 0 === this._regFlags & this.FLAG_SF_MASK ||
                             1 <=  this._regFlags & this.FLAG_OF_MASK ) ) )
                    {
                        this._shortJump();
                    }
                    else
                    {
                        this._regIP += 2;
                    }
                    break;


                /**
                 * Instruction : LODSB
                 * Meaning     : Load byte sized string
                 * Notes       : Transfers string element addressed by DS:SI (even if an
                 *               operand is supplied) to the accumulator. SI is
                 *               incremented based on the size of the operand or based
                 *               on the instruction used. If the Direction Flag is set SI
                 *               is decremented, if the Direction Flag is clear SI is
                 *               incremented. Use with REP prefixes.
                 */
                case 0xAC:
                    addr = this._regDI + this._regSI;
                    //this._regAH = 0;
                    this._regAL = this._memoryV[this.segment2absolute(this._regDS, addr)];

                    if (this._regFlags & this.FLAG_DF_MASK) this._regSI -= 1;
                    else  this._regSI += 1;

                    this._regIP += 1;
                    break;

                /**
                 * Instruction : LODSW
                 * Meaning     : Load word sized string
                 * Notes       : Transfers string element addressed by DS:SI (even if an
                 *               operand is supplied) to the accumulator. SI is
                 *               incremented based on the size of the operand or based
                 *               on the instruction used. If the Direction Flag is set SI
                 *               is decremented, if the Direction Flag is clear SI is
                 *               incremented. Use with REP prefixes.
                 */
                case 0xAD:
                    addr = this._regDI + this._regSI;
                    this._regAH = this._memoryV[this.segment2absolute(this._regDS, addr + 1)];
                    this._regAL = this._memoryV[this.segment2absolute(this._regDS, addr)];

                    if (this._regFlags & this.FLAG_DF_MASK) this._regSI -= 1;
                    else  this._regSI += 1;

                    this._regIP += 1;
                    break;

                /**
                 * Instruction : MOV
                 * Meaning     : Copy operand2 to operand1.
                 * Notes       : This instruction has no addressing byte
                 * Length      : 2-6 bytes
                 * Cycles      :
                 *   The MOV instruction cannot:
                 *    - set the value of the CS and IP registers.
                 *    - copy value of one segment register to another segment
                 *      register (should copy to general register first).
                 *    - copy immediate value to segment register (should copy to
                 *      general register first).
                 */
                case 0x88:
                case 0x89:
                    valSrc =  this._getRegValueForOp(opcode);
                    this._setRMValueForOp(opcode, valSrc);

                    this._regIP += (_tempIP + 2);
                    break;
                case 0x8A:
                case 0x8B:
                    valSrc = this._getRMValueForOp(opcode);
                    this._setRegValueForOp(opcode, valSrc);

                    this._regIP += (_tempIP + 2);
                    break;
                case 0x8C:
                case 0x8E:
                    valSrc = this._getRegValueForOp(opcode);
                    this._setRegValueForOp(opcode, valSrc);

                    this._regIP += (_tempIP + 2);
                    break;
                // Move with displacement ???
                case 0xA0:
                    addr = (this._memoryV[this.segment2absolute(this._regCS, this._regIP + 2)] << 8) |
                            this._memoryV[this.segment2absolute(this._regCS, this._regIP + 1)];
                    this._regAL = this._memoryV[this.segment2absolute(this._regCS, addr)];

                    this._regIP += 3;
                    break;
                case 0xA1:
                    addr = (this._memoryV[this.segment2absolute(this._regCS, this._regIP + 2)] << 8) |
                            this._memoryV[this.segment2absolute(this._regCS, this._regIP + 1)];
                    valSrc = (this._memoryV[this.segment2absolute(this._regCS, addr + 1)] << 8) |
                              this._memoryV[this.segment2absolute(this._regCS, addr)];

                    this._regAH = ((valSrc >> 8) & 0x0FF);
                    this._regAL = (valSrc & 0x00FF);

                    this._regIP += 3;
                    break;
                case 0xA2:
                    addr = (this._memoryV[this.segment2absolute(this._regCS, this._regIP + 2)] << 8) |
                            this._memoryV[this.segment2absolute(this._regCS, this._regIP + 1)];

                    this._memoryV[this.segment2absolute(this._regCS, addr)] = (this._regAL & 0x00FF);

                    this._regIP += 3;
                    break;
                case 0xA3:
                    addr = (this._memoryV[this.segment2absolute(this._regCS, this._regIP + 2)] << 8) |
                            this._memoryV[this.segment2absolute(this._regCS, this._regIP + 1)];

                    this._memoryV[this.segment2absolute(this._regCS, addr)]     = (this._regAL & 0x00FF);
                    this._memoryV[this.segment2absolute(this._regCS, addr + 1)] = ((this._regAH >> 8) & 0x00FF);

                    this._regIP += 3;
                    break;
                // Move Immediate byte into register (e.g, MOV AL Ib)
                case 0xB0:
                    this._regAL = this._memoryV[this.segment2absolute(this._regCS, this._regIP + 1)];
                    this._regIP += 2;
                    break;
                case 0xB1:
                    this._regCL = this._memoryV[this.segment2absolute(this._regCS, this._regIP + 1)];
                    this._regIP += 2;
                    break;
                case 0xB2:
                    this._regDL = this._memoryV[this.segment2absolute(this._regCS, this._regIP + 1)];
                    this._regIP += 2;
                    break;
                case 0xB3:
                    this._regBL = this._memoryV[this.segment2absolute(this._regCS, this._regIP + 1)];
                    this._regIP += 2;
                    break;
                case 0xB4:
                    this._regAH = this._memoryV[this.segment2absolute(this._regCS, this._regIP + 1)];
                    this._regIP += 2;
                    break;
                case 0xB5:
                    this._regCH = this._memoryV[this.segment2absolute(this._regCS, this._regIP + 1)];
                    this._regIP += 2;
                    break;
                case 0xB6:
                    this._regDH = this._memoryV[this.segment2absolute(this._regCS, this._regIP + 1)];
                    this._regIP += 2;
                    break;
                case 0xB7:
                    this._regBH = this._memoryV[this.segment2absolute(this._regCS, this._regIP + 1)];
                    this._regIP += 2;
                    break;
                // Move Immediate word into register (e.g, MOV AX Ib)
                case 0xB8:
                    this._regAH = this._memoryV[this.segment2absolute(this._regCS, this._regIP + 2)];
                    this._regAL = this._memoryV[this.segment2absolute(this._regCS, this._regIP + 1)];
                    this._regIP += 3;
                    break;
                case 0xB9:
                    this._regCH = this._memoryV[this.segment2absolute(this._regCS, this._regIP + 2)];
                    this._regCL = this._memoryV[this.segment2absolute(this._regCS, this._regIP + 1)];
                    this._regIP += 3;
                    break;
                case 0xBA:
                    this._regDH = this._memoryV[this.segment2absolute(this._regCS, this._regIP + 2)];
                    this._regDL = this._memoryV[this.segment2absolute(this._regCS, this._regIP + 1)];
                    this._regIP += 3;
                    break;
                case 0xBB:
                    this._regBH = this._memoryV[this.segment2absolute(this._regCS, this._regIP + 2)];
                    this._regBL = this._memoryV[this.segment2absolute(this._regCS, this._regIP + 1)];
                    this._regIP += 3;
                    break;
                case 0xBC:
                    this._regSP = ((this._memoryV[this.segment2absolute(this._regCS, this._regIP + 2)] << 8) |
                                    this._memoryV[this.segment2absolute(this._regCS, this._regIP + 1)]);
                    this._regIP += 3;
                    break;
                case 0xBD:
                    this._regBP = ((this._memoryV[this.segment2absolute(this._regCS, this._regIP + 2)] << 8) |
                                    this._memoryV[this.segment2absolute(this._regCS, this._regIP + 1)]);
                    this._regIP += 3;
                    break;
                case 0xBE:
                    this._regSI = ((this._memoryV[this.segment2absolute(this._regCS, this._regIP + 2)] << 8) |
                                    this._memoryV[this.segment2absolute(this._regCS, this._regIP + 1)]);
                    this._regIP += 3;
                    break;
                case 0xBF:
                    this._regDI = ((this._memoryV[this.segment2absolute(this._regCS, this._regIP + 2)] << 8) |
                                    this._memoryV[this.segment2absolute(this._regCS, this._regIP + 1)]);
                    this._regIP += 3;
                    break;
                case 0xC6:
                    ipRMInc = this._getRMIncIP(opcode);
                    valSrc = this._memoryV[this.segment2absolute(this._regCS, this._regIP + ipRMInc + 2)];
                    this._setRMValueForOp(opcode, valSrc);
                    this._regIP += (_tempIP + 3);
                    break;
                case 0xC7:
                    ipRMInc = this._getRMIncIP(opcode);
                    valSrc = (this._memoryV[this.segment2absolute(this._regCS, this._regIP + ipRMInc + 3)] << 8) |
                              this._memoryV[this.segment2absolute(this._regCS, this._regIP + ipRMInc + 2)];
                    this._setRMValueForOp(opcode, valSrc);
                    this._regIP += (_tempIP + 4);
                    break;

                /**
                 * Instruction : NOP
                 * Meaning     : Logical inclusive or of the operands
                 * Notes       :
                 */
                case 0x90:
                    this._regIP += 1;
                    break;

                /**
                 * Instruction : OR
                 * Meaning     : Logical inclusive or of the operands
                 * Notes       :
                 */
                case 0x08:
                case 0x0A:
                    valDst = this._getRMValueForOp(opcode);
                    valSrc = this._getRegValueForOp(opcode);

                    valResult = (valDst || valSrc) & 0x00FF;
                    this._setRMValueForOp(opcode, valResult);

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_ZF_MASK),
                        'b',
                        "or");

                    this._regIP += (_tempIP + 2);

                    break;
                case 0x09:
                case 0x0B:
                    valDst = this._getRMValueForOp(opcode);
                    valSrc = this._getRegValueForOp(opcode);

                    valResult = (valDst || valSrc) & 0xFFFF;
                    this._setRMValueForOp(opcode, valResult);

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_ZF_MASK),
                        'w',
                        "or");

                    this._regIP += (_tempIP + 2);

                    break;
                case 0x0C:
                    valDst = this._regAL;
                    valSrc = (this._memoryV[this.segment2absolute(this._regCS, this._regIP + 1)]);

                    this._regAL = (valDst || valSrc) & 0x00FF;

                    this._setFlags(
                        valDst,
                        valSrc,
                        this._regAL,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_ZF_MASK),
                        'b',
                        "or");

                    this._regIP += 2;

                    break;
                case 0x0D:
                    valDst = ((this._regAH << 8) | this._regAL);
                    valSrc = ((this._memoryV[this.segment2absolute(this._regCS, this._regIP + 2)] << 8) |
                               this._memoryV[this.segment2absolute(this._regCS, this._regIP + 1)]);

                    valResult = valDst || valSrc;

                    this._regAH = (valResult & 0xFF00) >> 8;
                    this._regAL = (valResult & 0x00FF);

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_ZF_MASK),
                        'w',
                        "or");

                    this._regIP += 3;

                    break;

                /**
                 * Instruction : OUT
                 * Meaning     : Output from AL or AX to port.
                 * Notes       : First operand is a port number. If required to
                 *               access port number over 255 - DX register
                 *               should be used.
                 */
                case 0xE6:
                    var port = this._memoryV[this._regIP + 1];
                    this._portsV[port] = this._regAL;
                    this._regIP += 2;
                    break;
                case 0xE7:
                    var port = this._memoryV[this._regIP + 1];
                    this._portsV[port] = ((this._regH << 8) | this._regAL);
                    this._regIP += 2;
                    break;
                case 0xEE:
                    var port = ((this._regDH << 8) | this._regDL);
                    this._portsV[port] = this._regAL;
                    this._regIP += 1;
                    break;
                case 0xEF:
                    var port = ((this._regDH << 8) | this._regDL);
                    this._portsV[port] = ((this._regH << 8) | this._regAL);
                    this._regIP += 1;
                    break;

                /**
                 * Instruction : POP
                 * Meaning     : Get 16 bit value from the stack.
                 * Notes       :
                 */
                case 0x07:
                    this._regES = this._pop();
                    this._regIP += 1;
                    break;
                case 0x17:
                    this._regSS = this._pop();
                    this._regIP += 1;
                    break;
                case 0x1F:
                    this._regDS = this._pop();
                    this._regIP += 1;
                    break;
                case 0x58:
                    valResult = this._pop();
                    this._regAH = (valResult & 0xFF00) >> 8;
                    this._regAL = (valResult & 0x00FF);
                    this._regIP += 1;
                    break;
                case 0x59:
                    valResult = this._pop();
                    this._regCH = (valResult & 0xFF00) >> 8;
                    this._regCL = (valResult & 0x00FF);
                    this._regIP += 1;
                    break;
                case 0x5A:
                    valResult = this._pop();
                    this._regDH = (valResult & 0xFF00) >> 8;
                    this._regDL = (valResult & 0x00FF);
                    this._regIP += 1;
                    break;
                case 0x5B:
                    valResult = this._pop();
                    this._regBH = (valResult & 0xFF00) >> 8;
                    this._regBL = (valResult & 0x00FF);
                    this._regIP += 1;
                    break;
                case 0x5C:
                    this._regSP = this._pop();
                    this._regIP += 1;
                    break;
                case 0x5D:
                    this._regBP = this._pop();
                    this._regIP += 1;
                    break;
                case 0x5E:
                    this._regSI = this._pop();
                    this._regIP += 1;
                    break;
                case 0x5F:
                    this._regDI = this._pop();
                    this._regIP += 1;
                    break;
                case 0x8F:
                    // This one isn't as easy
                    if (_breakOnError) _Cpu.halt({
                        error      : true,
                        enterDebug : true,
                        message    : "[c:" + _Cpu._cycles + "] Opcode not implemented! [0x" + opcode_byte.toString(16) + "]",
                        decObj     : opcode,
                        regObj     : this._bundleRegisters(),
                        memObj     : this._memoryV
                    });
                    break;

                /**
                 * Instruction : PUSH
                 * Meaning     : Store 16 bit value in the stack.
                 * Notes       :
                 */
                case 0x06:
                    this._push(this._regES);
                    this._regIP += 1;
                    break;
                case 0x0E:
                    this._push(this._regCS);
                    this._regIP += 1;
                    break;
                case 0x16:
                    this._push(this._regSS);
                    this._regIP += 1;
                    break;
                case 0x1E:
                    this._push(this._regDS);
                    this._regIP += 1;
                    break;
                case 0x50:
                    this._push(((this._regAH << 8) | this._regAL));
                    this._regIP += 1;
                    break;
                case 0x51:
                    this._push(((this._regCH << 8) | this._regCL));
                    this._regIP += 1;
                    break;
                case 0x52:
                    this._push(((this._regDH << 8) | this._regDL));
                    this._regIP += 1;
                    break;
                case 0x53:
                    this._push(((this._regBH << 8) | this._regBL));
                    this._regIP += 1;
                    break;
                case 0x54:
                    this._push(this._regSP);
                    this._regIP += 1;
                    break;
                case 0x55:
                    this._push(this._regBP);
                    this._regIP += 1;
                    break;
                case 0x56:
                    this._push(this._regSI);
                    this._regIP += 1;
                    break;
                case 0x57:
                    this._push(this._regDI);
                    this._regIP += 1;
                    break;

                /**
                 * Instruction : RET
                 * Meaning     : Return From Procedure.
                 * Notes       :
                 */
                case 0xC2:
                    if (_breakOnError) _Cpu.halt({
                        error      : true,
                        enterDebug : true,
                        message    : "[c:" + _Cpu._cycles + "] Opcode not implemented! [0x" + opcode_byte.toString(16) + "]",
                        decObj     : opcode,
                        regObj     : this._bundleRegisters(),
                        memObj     : this._memoryV
                    });
                    break;
                case 0xC3:
                    this._regIP = this._pop();
                    break;

                /**
                 * Instruction : SBB
                 * Meaning     : Subtract with borrow
                 * Notes       : Subtracts the two operands, if CF is set subtracts
                 *               one from the result
                 */
                case 0x18 :
                    valDst = this._getRMValueForOp(opcode);  // E
                    valSrc = this._getRegValueForOp(opcode); // G

                    valResult = valDst - valSrc;
                    if (this._regFlags & this.FLAG_CF_MASK) valResult -= 1;

                    // Handle underflow correctly
                    if (valResult < 0)
                    {
                        valResult = 0x00FF + 1 + valResult;
                    }

                    // Set clamped byte
                    this._setRMValueForOp(opcode, (valResult & 0x00FF));

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        "b",
                        "add");

                    this._regIP += (_tempIP + 2);

                    break;
                case 0x19 :
                    valDst = this._getRMValueForOp(opcode);  // E
                    valSrc = this._getRegValueForOp(opcode); // G

                    valResult = valDst - valSrc;
                    if (this._regFlags & this.FLAG_CF_MASK) valResult -= 1;

                    // Handle underflow correctly
                    if (valResult < 0)
                    {
                        valResult = 0xFFFF + 1 + valResult;
                    }

                    // Set clamped word
                    this._setRMValueForOp(opcode, (valResult & 0xFFFF));

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        "w",
                        "add");

                    this._regIP += (_tempIP + 2);

                    break;
                case 0x1A :
                    valDst = this._getRegValueForOp(opcode); // G
                    valSrc = this._getRMValueForOp(opcode);  // E

                    valResult = valDst - valSrc;
                    if (this._regFlags & this.FLAG_CF_MASK) valResult -= 1;

                    // Handle underflow correctly
                    if (valResult < 0)
                    {
                        valResult = 0x00FF + 1 + valResult;
                    }

                    // Set clamped byte
                    this._setRMValueForOp(opcode, (valResult & 0x00FF));

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        "b",
                        "add");

                    this._regIP += (_tempIP + 2);

                    break;
                case 0x1B :
                    valDst = this._getRegValueForOp(opcode); // G
                    valSrc = this._getRMValueForOp(opcode);  // E

                    valResult = valDst - valSrc;
                    if (this._regFlags & this.FLAG_CF_MASK) valResult -= 1;

                    // Handle underflow correctly
                    if (valResult < 0)
                    {
                        valResult = 0xFFFF + 1 + valResult;
                    }

                    // Set clamped word
                    this._setRMValueForOp(opcode, (valResult & 0xFFFF));

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        "w",
                        "add");

                    this._regIP += (_tempIP + 2);

                    break;
                case 0x1C :
                    ipRMInc = this._getRMIncIP(opcode);

                    valDst = this._regAL;
                    valSrc = this._memoryV[this.segment2absolute(this._regCS, this._regIP + ipRMInc + 1)];

                    valResult = valDst - valSrc;
                    if (this._regFlags & this.FLAG_CF_MASK) valResult -= 1;

                    // Handle underflow correctly
                    if (valResult < 0)
                    {
                        valResult = 0x00FF + 1 + valResult;
                    }

                    // Set clamped byte
                    this._setRMValueForOp(opcode, (valResult & 0x00FF));

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        "b",
                        "add");

                    this._regIP += (_tempIP + 1);

                    break;
                case 0x1D :
                    ipRMInc = this._getRMIncIP(opcode);

                    valDst = ((this._regAH << 8) | this._regAL);
                    valSrc = ((this._memoryV[this.segment2absolute(this._regCS, this._regIP + ipRMInc + 2)] << 8) |
                               this._memoryV[this.segment2absolute(this._regCS, this._regIP + ipRMInc + 1)]);

                    valResult = valDst - valSrc;
                    if (this._regFlags & this.FLAG_CF_MASK) valResult -= 1;

                    // Handle underflow correctly
                    if (valResult < 0)
                    {
                        valResult = 0xFFFF + 1 + valResult;
                    }

                    // Set clamped word
                    this._setRMValueForOp(opcode, (valResult & 0xFFFF));

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        "w",
                        "add");

                    this._regIP += (_tempIP + 1);

                    break;

                /**
                 * Instruction : STC
                 * Meaning     : Set Carry flag.
                 * Notes       :
                 */
                case 0xF9:
                    this._regFlags |= this.FLAG_CF_MASK;
                    this._regIP += 1;
                    break;

                /**
                 * Instruction : STI
                 * Meaning     : Set Interrupt flag.
                 * Notes       :
                 */
                case 0xFB:
                    this._regFlags |= this.FLAG_IF_MASK;
                    this._regIP += 1;
                    break;

                /**
                 * Instruction : STD
                 * Meaning     : Set Direction flag.
                 * Notes       :
                 */
                case 0xFD:
                    this._regFlags |= this.FLAG_DF_MASK;
                    this._regIP += 1;
                    break;

                /**
                 * Instruction : STOSB
                 * Meaning     : Store byte in AL into ES:[DI]. Update DI.
                 * Notes       : This instruction uses the following algorithm
                 *               - ES:[DI] = AX
                 *               - If DF = 0
                 *                    - DI = DI + 2
                 *               - else
                 *                    - DI = DI - 2
                 */
                case 0xAA:
                    this._memoryV[this.segment2absolute(this._regES, this._regDI)] = this._regAL;

                    if (this._regFlags & this.FLAG_DF_MASK) self._regDI += 1;
                    else self._regDI -= 1;

                    this._regIP += 1;

                    break;

                /**
                 * Instruction : STOSW
                 * Meaning     : Store word in AX into ES:[DI]. Update DI.
                 * Notes       : This instruction uses the following algorithm
                 *               - ES:[DI] = AX
                 *               - If DF = 0
                 *                    - DI = DI + 2
                 *               - else
                 *                    - DI = DI - 2
                 */
                case 0xAB:
                    this._memoryV[this.segment2absolute(this._regES, this._regDI)] = this._regAL;
                    this._memoryV[this.segment2absolute(this._regES, this._regDI) + 1] = this._regAH;

                    if (this._regFlags & this.FLAG_DF_MASK) self._regDI += 2;
                    else self._regDI -= 2;

                    this._regIP += 1;

                    break;


                /**
                 * Instruction : SUB
                 * Meaning     : Subtract
                 * Notes       : The source is subtracted from the destination and
                 *               the result is stored in the destination
                 */
                case 0x28:
                    valDst = this._getRMValueForOp(opcode);  // E
                    valSrc = this._getRegValueForOp(opcode); // G

                    valResult = valDst - valSrc;

                    // Handle underflow correctly
                    if (valResult < 0)
                    {
                        valResult = 0x00FF + 1 + valResult;
                    }

                    this._setRMValueForOp(opcode, valResult & 0x00FF);

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        "b",
                        "add");

                    this._regIP += (_tempIP + 2);

                    break;
                case 0x29:
                    valDst = this._getRMValueForOp(opcode);  // E
                    valSrc = this._getRegValueForOp(opcode); // G

                    valResult = valDst - valSrc;

                    // Handle underflow correctly
                    if (valResult < 0)
                    {
                        valResult = 0xFFFF + 1 + valResult;
                    }

                    this._setRMValueForOp(opcode, valResult & 0xFFFF);

                    // correct for direct addressing IP counting
                    if (0 === opcode.mod && 6 === opcode.rm)
                    {
                        _tempIP -= 2;
                    }

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        "w",
                        "add");

                    this._regIP += (_tempIP + 2);

                    break;
                case 0x2A:
                    valDst = this._getRegValueForOp(opcode); // G
                    valSrc = this._getRMValueForOp(opcode);  // E

                    valResult = valDst - valSrc;

                    // Handle underflow correctly
                    if (valResult < 0)
                    {
                        valResult = 0x00FF + 1 + valResult;
                    }

                    this._setRegValueForOp(opcode, valResult & 0x00FF);

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        "b",
                        "add");

                    this._regIP += (_tempIP + 2);

                    break;
                case 0x2B:
                    valDst = this._getRegValueForOp(opcode); // G
                    valSrc = this._getRMValueForOp(opcode);  // E

                    valResult = valDst - valSrc;

                    // Handle underflow correctly
                    if (valResult < 0)
                    {
                        valResult = 0xFFFF + 1 + valResult;
                    }

                    this._setRMValueForOp(opcode, valResult & 0xFFFF);

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        "w",
                        "add");

                    this._regIP += (_tempIP + 2);

                    break;

                case 0x2C:
                    valDst = this._regAL;
                    valSrc = this._memoryV[this.segment2absolute(this._regCS, this._regIP + 1)];

                    valResult = valDst - valSrc;

                    // Handle underflow correctly
                    if (valResult < 0)
                    {
                        valResult = 0x00FF + 1 + valResult;
                    }

                    this._regAL = valResult & 0x00FF;

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        "b",
                        "add");

                    this._regIP += 2;

                    break;
                case 0x2D:
                    valDst = ((this._regAH << 8) | this._regAL);
                    valSrc = ((this._memoryV[this.segment2absolute(this._regCS, this._regIP + 2)] << 8) |
                               this._memoryV[this.segment2absolute(this._regCS, this._regIP + 1)]);

                    valResult = valDst - valSrc;

                    // Handle underflow correctly
                    if (valResult < 0)
                    {
                        valResult = 0xFFFF + 1 + valResult;
                    }

                    this._regAH = (valResult & 0xFF00) >> 8;
                    this._regAL = (valResult & 0x00FF);

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_ZF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_AF_MASK),
                        "w",
                        "add");

                    this._regIP += 3;

                    break;

                /**
                 * Instruction : XCHG
                 * Meaning     : Exchange contents of source and destination
                 * Notes       :
                 */
                case 0x86 :
                case 0x87 :
                    valDst = this._getRegValueForOp(opcode); // G
                    valSrc = this._getRMValueForOp(opcode);  // E

                    this._setRegValueForOp(opcode, valSrc);
                    this._setRMValueForOp(opcode, valDst);

                    this._regIP += (_tempIP + 2);

                    break;
                case 0x91 :
                    // Exchange CX and AX
                    valDst = ((this._regCH << 8) | this._regCL);
                    valSrc = ((this._regAH << 8) | this._regAL);

                    this._regAH = (valDst & 0xFF00) >> 8;
                    this._regAL = (valDst & 0x00FF);

                    this._regCH = (valSrc & 0xFF00) >> 8;
                    this._regCL = (valSrc & 0x00FF);

                    this._regIP += 1;

                    break;
                case 0x92 :
                    // Exchange DX and AX
                    valDst = ((this._regDH << 8) | this._regDL);
                    valSrc = ((this._regAH << 8) | this._regAL);

                    this._regAH = (valDst & 0xFF00) >> 8;
                    this._regAL = (valDst & 0x00FF);

                    this._regDH = (valSrc & 0xFF00) >> 8;
                    this._regDL = (valSrc & 0x00FF);

                    this._regIP += 1;

                    break;
                case 0x93 :
                    // Exchange BX and AX
                    valDst = ((this._regBH << 8) | this._regBL);
                    valSrc = ((this._regAH << 8) | this._regAL);

                    this._regAH = (valDst & 0xFF00) >> 8;
                    this._regAL = (valDst & 0x00FF);

                    this._regBH = (valSrc & 0xFF00) >> 8;
                    this._regBL = (valSrc & 0x00FF);

                    this._regIP += 1;

                    break;
                case 0x94 :
                    // Exchange SP and AX
                    valDst = this._regSP;
                    valSrc = ((this._regAH << 8) | this._regAL);

                    this._regAH = (valDst & 0xFF00) >> 8;
                    this._regAL = (valDst & 0x00FF);

                    this._regSP = valSrc;

                    this._regIP += 1;

                    break;
                case 0x95 :
                    // Exchange BP and AX
                    valDst = this._regBP;
                    valSrc = ((this._regAH << 8) | this._regAL);

                    this._regAH = (valDst & 0xFF00) >> 8;
                    this._regAL = (valDst & 0x00FF);

                    this._regBP = valSrc;

                    this._regIP += 1;

                    break;
                case 0x96 :
                    // Exchange SI and AX
                    valDst = this._regSI;
                    valSrc = ((this._regAH << 8) | this._regAL);

                    this._regAH = (valDst & 0xFF00) >> 8;
                    this._regAL = (valDst & 0x00FF);

                    this._regSI = valSrc;

                    this._regIP += 1;

                    break;
                case 0x97 :
                    // Exchange DI and AX
                    valDst = this._regDI;
                    valSrc = ((this._regAH << 8) | this._regAL);

                    this._regAH = (valDst & 0xFF00) >> 8;
                    this._regAL = (valDst & 0x00FF);

                    this._regDI = valSrc;

                    this._regIP += 1;

                    break;

                /**
                 * Instruction : XOR
                 * Meaning     : Performs a bitwise exclusive or of the operands.
                 * Notes       :
                 */
                case 0x30:
                    valDst = this._getRMValueForOp(opcode);
                    valSrc = this._getRegValueForOp(opcode);

                    valResult = (valDst ^ valSrc) & 0x00FF;
                    this._setRMValueForOp(opcode, valResult);

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_ZF_MASK),
                        'b',
                        "or");

                    this._regIP += (_tempIP + 2);

                    break;
                case 0x31:
                    valDst = this._getRMValueForOp(opcode);
                    valSrc = this._getRegValueForOp(opcode);

                    valResult = (valDst ^ valSrc) & 0xFFFF;
                    this._setRMValueForOp(opcode, valResult);

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_ZF_MASK),
                        'w',
                        "or");

                    this._regIP += (_tempIP + 2);

                    break;
                case 0x32:
                    valDst = this._getRegValueForOp(opcode);
                    valSrc = this._getRMValueForOp(opcode);

                    valResult = (valDst ^ valSrc) & 0x00FF;
                    this._setRegValueForOp(opcode, valResult);

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_ZF_MASK),
                        'b',
                        "or");

                    this._regIP += (_tempIP + 2);

                    break;
                case 0x33:
                    valDst = this._getRegValueForOp(opcode);
                    valSrc = this._getRMValueForOp(opcode);

                    valResult = (valDst ^ valSrc) & 0xFFFF;
                    this._setRegValueForOp(opcode, valResult);

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_ZF_MASK),
                        'w',
                        "or");

                    this._regIP += (_tempIP + 2);

                    break;
                case 0x34:
                    valDst = this._regAL;
                    valSrc = this._memoryV[this.segment2absolute(this._regCS, this._regIP + 1)];

                    valResult = (valDst ^ valSrc) & 0x00FF;
                    this._regAL = valResult;

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_ZF_MASK),
                        'b',
                        "or");

                    this._regIP += (_tempIP + 1);

                    break;
                case 0x35:
                    valDst = ( (this._regAH << 8) | this._regAL );
                    valSrc = ((this._memoryV[this.segment2absolute(this._regCS, this._regIP + 2)] << 8) |
                               this._memoryV[this.segment2absolute(this._regCS, this._regIP + 1)]);

                    valResult = (valDst ^ valSrc) & 0xFFFF;
                    this._regAL = valResult;

                    this._setFlags(
                        valDst,
                        valSrc,
                        valResult,
                        (   this.FLAG_CF_MASK |
                            this.FLAG_OF_MASK |
                            this.FLAG_PF_MASK |
                            this.FLAG_SF_MASK |
                            this.FLAG_ZF_MASK),
                        'w',
                        "or");

                    this._regIP += 3;

                    break;
                // x86 does not have instructions for all possible opcodes
                case 0x60:
                case 0x61:
                case 0x62:
                case 0x63:
                case 0x64:
                case 0x65:
                case 0x66:
                case 0x67:
                case 0xC0:
                case 0xC1:
                case 0xC8:
                case 0xC9:
                case 0xD6:
                case 0xD8:
                case 0xD9:
                case 0xDA:
                case 0xDB:
                case 0xDC:
                case 0xDD:
                case 0xDE:
                case 0xDF:
                case 0xF1:
                    if (_breakOnError) _Cpu.halt({
                        error      : true,
                        enterDebug : true,
                        message    : "[c:" + _Cpu._cycles + "] Invalid opcode [0x" + opcode_byte.toString(16) + "]",
                        decObj     : opcode,
                        regObj     : this._bundleRegisters(),
                        memObj     : this._memoryV
                    });
                    break;
                default :
                    if (_breakOnError) _Cpu.halt({
                        error      : true,
                        enterDebug : true,
                        message    : "[c:" + _Cpu._cycles + "] Unknown opcode [0x" + opcode_byte.toString(16) + "]",
                        decObj     : opcode,
                        regObj     : this._bundleRegisters(),
                        memObj     : this._memoryV
                    });
            }

            // TODO: Update timers

            // Post-cycle Debug
            if (_Cpu.isDebug())
            {
                // Don't update info if cpu was halted this cycle
                if (! _Cpu._haltFlag )
                {
                    var options = options || {
                        error      : false,
                        enterDebug : false,
                        message    : "[c:" + _Cpu._cycles + "] " + opcode.instruction,
                        decObj     : opcode
                    };

                    _Gui.debugUpdateInfo(options);
                }

                _Cpu.debugUpdateRegisters(this._bundleRegisters());

            }

        },

        _push : function (value)
        {
            // Update stack pointer
            this._regSP -= 2;

            this._memoryV[this.segment2absolute(this._regSS, this._regSP)]     = (value & 0x00FF);
            this._memoryV[this.segment2absolute(this._regSS, this._regSP + 1)] = (value >> 8);
        },

        _pop : function ()
        {
            // Get the value from the stack
            var value = ((this._memoryV[this.segment2absolute(this._regSS, this._regSP + 1)] << 8) |
                          this._memoryV[this.segment2absolute(this._regSS, this._regSP)]);

            // Zero the memory locations on the stack.
            // This isn't necessary but helps with debugging
            this._memoryV[this.segment2absolute(this._regSS, this._regSP)]     = 0;
            this._memoryV[this.segment2absolute(this._regSS, this._regSP + 1)] = 0;


            this._regSP += 2;

            return value;
        },

        /**
         * Execute Short Jump (one-byte address)
         * @private
         */
        _shortJump : function ()
        {
            // The jump address is a signed (twos complement) offset from the
            // current location.
            var offset = this._memoryV[this.segment2absolute(this._regCS, this._regIP + 1)];

            // One-byte twos-complement conversion
            // It seems Javascript does not do ~ (bitwise not) correctly
            var negative = ((offset >> 7) === 1);
            offset = negative ? (-1 * (offset >> 7)) * ((offset ^ 0xFF) + 1) : offset;

            // We must skip the last byte of this instruction
            this._regIP += (offset + 2);
        },

        /**
         * Generic method to set flags for give operands and result
         *
         * TODO: This hasn't been tested for all operations
         *
         * @param operand1
         * @param operand2
         * @param result
         * @param flagsToSet
         * @param size (only used for OF)
         * @param operation (add | sub | mul | div | or)
         * @private
         */
        _setFlags : function (operand1, operand2, result, flagsToSet, size, operation)
        {
            // Set defaults
            size = size || 'b';

            // Carry Flag (CF)
            // Indicates when an arithmetic carry or borrow has been generated
            // out of the most significant ALU bit position
            if (flagsToSet & this.FLAG_CF_MASK)
            {
                // is this addition (this seems like a stupid way to handle this)
                switch (operation)
                {
                    case "or" :
                    case "add" :
                        if ('b' === size && result > 0xFF) this._regFlags |= this.FLAG_CF_MASK;
                        else if ('w' === size && result > 0xFFFF) this._regFlags |= this.FLAG_CF_MASK;
                        else this._regFlags &= ~this.FLAG_CF_MASK;
                        break;
                    case "sub" :
                        if (operand1 < operand2) this._regFlags |= this.FLAG_CF_MASK;
                        else this._regFlags &= ~this.FLAG_CF_MASK;
                        break;
                    case "mul" :
                        if (_breakOnError) _Cpu.halt({
                            error      : true,
                            enterDebug : true,
                            message    : "Multiply CF flag not implemented!",
                            decObj     : opcode,
                            regObj     : this._bundleRegisters(),
                            memObj     : this._memoryV
                        });
                        break;
                    case "div" :
                        if (_breakOnError) _Cpu.halt({
                            error      : true,
                            enterDebug : true,
                            message    : "Multiply CF flag not implemented!",
                            decObj     : opcode,
                            regObj     : this._bundleRegisters(),
                            memObj     : this._memoryV
                        });
                        break;
                }
            }

            // Parity Flag (PF)
            // Indicates if the number of set bits is odd or even in the binary
            // representation of the result of the last operation
            if (flagsToSet & this.FLAG_PF_MASK)
            {
                var bitRep = result.toString(2),
                    bitCnt = 0;
                for (b in bitRep) { if ("1" === bitRep[b]) bitCnt++; }

                if (0 === (bitCnt % 2))
                {
                    this._regFlags |= this.FLAG_PF_MASK;
                }
                else
                {
                    this._regFlags &= ~this.FLAG_PF_MASK;
                }
            }

            // Adjust Flag (AF)
            // Indicate when an arithmetic carry or borrow has been generated out
            // of the 4 least significant bits.
            if (flagsToSet & this.FLAG_AF_MASK)
            {
                switch (operation)
                {
                    case "or" :
                    case "add" :
                        if ((result & 0x0F) > 0x0F) this._regFlags |= this.FLAG_AF_MASK;
                        else this._regFlags &= ~this.FLAG_AF_MASK;
                        break;
                    case "sub" :
                        if ((operand1 & 0x0F) < (operand2 & 0x0F)) this._regFlags |= this.FLAG_AF_MASK;
                        else this._regFlags &= ~this.FLAG_AF_MASK;
                        break;
                    case "mul" :
                        if (_breakOnError) _Cpu.halt({
                            error      : true,
                            enterDebug : true,
                            message    : "Multiply AF flag not implemented!",
                            decObj     : opcode,
                            regObj     : this._bundleRegisters(),
                            memObj     : this._memoryV
                        });
                        break;
                    case "div" :
                        if (_breakOnError) _Cpu.halt({
                            error      : true,
                            enterDebug : true,
                            message    : "Division AF flag not implemented!",
                            decObj     : opcode,
                            regObj     : this._bundleRegisters(),
                            memObj     : this._memoryV
                        });
                        break;
                }

            }

            // Zero Flag (ZF)
            // Indicates when the result of an arithmetic operation, including
            // bitwise logical instructions is zero, and reset otherwise.
            if (flagsToSet & this.FLAG_ZF_MASK)
            {
                if (0 === result) this._regFlags |= this.FLAG_ZF_MASK;
                else this._regFlags &= ~this.FLAG_ZF_MASK;
            }

            // Sign Flag (SF)
            // Indicate whether the result of the last mathematical operation
            // resulted in a value whose most significant bit was set
            if (flagsToSet & this.FLAG_SF_MASK)
            {
                if ('b' === size && (result & 0xFF) >> 7) this._regFlags |= this.FLAG_SF_MASK;
                else if ('w' === size && (result & 0xFFFF) >> 15) this._regFlags |= this.FLAG_SF_MASK;
                else this._regFlags &= ~this.FLAG_SF_MASK;
            }

            // Trap Flag (TF)
            // If the trap flag is set, the 8086 will automatically do a type-1
            // interrupt after each instruction executes. When the 8086 does a
            // type-1 interrupt, it pushes the flag register on the stack.
            if (flagsToSet & this.FLAG_TF_MASK)
            {
                this._regFlags |= this.FLAG_TF_MASK;
            }

            // Interrupt Flag (IF)
            // If the flag is set to 1, maskable hardware interrupts will be
            // handled. If cleared (set to 0), such interrupts will be ignored.
            // IF does not affect the handling of non-maskable interrupts or
            // software interrupts generated by the INT instruction.
            if (flagsToSet & this.FLAG_IF_MASK)
            {
                this._regFlags |= this.FLAG_IF_MASK;
            }

            // Direction Flag (DF)
            // Controls the left-to-right or right-to-left direction of string
            // processing. When it is set to 0 (using the clear-direction-flag
            // instruction CLD),[3] it means that instructions that autoincrement
            // the source index and destination index (like MOVS) will increase
            // both of them. In case it is set to 1 (using the set-direction-flag
            // instruction STD),the instruction will decrease them.
            if (flagsToSet & this.FLAG_DF_MASK)
            {
                this._regFlags |= this.FLAG_DF_MASK;
            }

            // Overflow Flag (OF)
            // Indicates when an arithmetic overflow has occurred in an operation,
            // indicating that the signed two's-complement result would not fit in
            // the number of bits used for the operation (the ALU width).
            if (flagsToSet & this.FLAG_OF_MASK)
            {
                var shift;
                if ('w' === size) shift = 15; else shift = 7;

                if ( 1 === (operand1 >> shift) && 1 === (operand2 >> shift) && 0 === (result >> shift) ||
                     0 === (operand1 >> shift) && 0 === (operand2 >> shift) && 1 === (result >> shift))
                    this._regFlags = this._regFlags | this.FLAG_OF_MASK;
                else this._regFlags &= ~this.FLAG_OF_MASK;
            }
        },

        _bundleRegisters : function ()
        {
            return {
                AX : ((this._regAH << 8) | this._regAL),
                AH : this._regAH,
                AL : this._regAL,
                BX : ((this._regBH << 8) | this._regBL),
                BH : this._regBH,
                BL : this._regBL,
                CX : ((this._regCH << 8) | this._regCL),
                CH : this._regCH,
                CL : this._regCL,
                DX : ((this._regDH << 8) | this._regDL),
                DH : this._regDH,
                DL : this._regDL,
                SI : this._regSI,
                DI : this._regDI,
                BP : this._regBP,
                SP : this._regSP,
                CS : this._regCS,
                DS : this._regDS,
                ES : this._regES,
                SS : this._regSS,
                IP : this._regIP,
                FLAGS : this._regFlags
            };
        },

        /**
         * Return a setting
         *
         * Used mostly for testing
         *
         * @param key
         * @returns {*}
         */
        t_getSetting : function (key) {
            return _settings[key];
        },

        /**
         * Return the _tempIP counter and reset it.
         *
         * @returns {number|*} _tempIP value before resetting
         */
        t_getTmpIPAndReset : function () {
            var tmpIP = _tempIP;
            _tempIP = 0;
            return tmpIP;
        }
    };

    return Cpu8086;
});