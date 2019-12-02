import { EventEmitter } from 'events'
import { Socket } from 'net'
import {
  SuggestedImportsResult,
  SuggestedImportResult,
} from './getSuggestedImports'
import { SuggestMessage, WheresMessage } from './Server'

declare class Client extends EventEmitter {
  constructor(projectRoot: string)
  connect(options?: { startServer?: boolean | null }): Promise<Socket>
  wheres(query: WheresMessage): Promise<Array<SuggestedImportResult>>
  suggest(query: SuggestMessage): Promise<SuggestedImportsResult>
  stopServer(): Promise<void>
  killServer(): Promise<void>
  close(): Promise<void>
}
export default Client
