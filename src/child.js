// @flow

import ModuleIndex from './ModuleIndex'
import WatchingIndexer from './WatchingIndexer'
import FlowParser from './parsers/flow'
import { type Message } from './index'
import delay from 'delay'

let index
let indexer

process.on(
  'message',
  async (message: Message): Promise<void> => {
    const { seq, start, getSuggestedImports, getProgress } = message
    if (start) {
      const { projectRoot } = start
      index = new ModuleIndex({ projectRoot })
      indexer = new WatchingIndexer({
        projectRoot,
        index,
        parser: new FlowParser(),
      })
      indexer.start()
    }
    if (getSuggestedImports) {
      await Promise.race([delay(15000), indexer.waitUntilReady()])
      const message = {
        seq,
        getSuggestedImports: index.getSuggestedImports(getSuggestedImports),
      }
      // $FlowFixMe
      process.send(message)
    }
    if (getProgress) {
      const message = {
        seq,
        getProgress: indexer.getProgress(),
      }
      // $FlowFixMe
      process.send(message)
    }
  }
)
