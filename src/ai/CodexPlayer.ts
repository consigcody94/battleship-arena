/**
 * OpenAI Codex CLI adapter for Battleship
 */

import { spawn } from 'child_process';
import { AIPlayer } from './AIPlayer.js';
import { PlayerType } from '../game/types.js';

export class CodexPlayer extends AIPlayer {
  type: PlayerType = 'codex';
  name = 'Codex';
  private model: string;
  private timeout: number;

  constructor(options: { model?: string; timeout?: number } = {}) {
    super();
    this.model = options.model || 'gpt-5';
    this.timeout = options.timeout || 60000;
    this.name = `Codex (${this.model})`;
  }

  async executePrompt(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const fs = require('fs');
      const path = require('path');
      const os = require('os');

      // Create temp file for output
      const outputFile = path.join(os.tmpdir(), `codex-${Date.now()}.txt`);

      // Use Codex exec mode with output to file
      const args = [
        'exec',
        '--skip-git-repo-check',
        '--full-auto',
        '-o', outputFile,
        prompt,
      ];

      const proc = spawn('codex', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: this.timeout,
        cwd: os.tmpdir(),  // Run in temp to avoid git issues
      });

      let stderr = '';

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const timeoutId = setTimeout(() => {
        proc.kill('SIGTERM');
        try { fs.unlinkSync(outputFile); } catch {}
        reject(new Error(`Codex CLI timeout after ${this.timeout}ms`));
      }, this.timeout);

      proc.on('close', (code) => {
        clearTimeout(timeoutId);
        try {
          if (fs.existsSync(outputFile)) {
            const output = fs.readFileSync(outputFile, 'utf-8').trim();
            fs.unlinkSync(outputFile);
            if (output) {
              resolve(output);
              return;
            }
          }
          // Fallback: if no output file, reject
          reject(new Error(`Codex CLI exited with code ${code}: ${stderr || 'No output'}`));
        } catch (err) {
          reject(new Error(`Codex CLI error: ${err}`));
        }
      });

      proc.on('error', (error) => {
        clearTimeout(timeoutId);
        try { fs.unlinkSync(outputFile); } catch {}
        reject(error);
      });
    });
  }

  /**
   * Check if Codex CLI is available
   */
  static async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn('codex', ['--version'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      proc.on('close', (code) => {
        resolve(code === 0);
      });

      proc.on('error', () => {
        resolve(false);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        proc.kill();
        resolve(false);
      }, 5000);
    });
  }
}
