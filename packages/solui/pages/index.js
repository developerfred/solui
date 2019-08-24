import React, { useState, useEffect, useCallback } from 'react'
import styled from '@emotion/styled'

import Layout from './components/Layout'
import { PanelBuilder } from './components/Panel'
import Error from './components/Error'
import NetworkInfo from './components/NetworkInfo'
import { process as processSpec, executeUi } from '../src/spec'
import { flex } from './styles/fragments'

const Container = styled.div``

const Panels = styled.ul`
  list-style: none;
  ${flex({ justify: 'flex-start', align: 'flex-start' })}
`

const PanelContainer = styled.li`
  display: block;
  border: 1px solid ${({ theme }) => theme.panelBorderColor};
  padding: 1rem;
  margin-bottom: 1rem;
`

export default ({ network, appState: { spec, artifacts } }) => {
  const [ processedResult, setProcessedResult ] = useState()

  // callback to execute a panel
  const onRun = useCallback(async ({ panelId, inputs }) => {
    if (network) {
      await executeUi({
        artifacts,
        ui: { id: panelId, config: spec[panelId] },
        inputs,
        web3: network.web3,
      })
    }
  }, [ spec, artifacts, network ])

  // update panels
  useEffect(() => {
    (async () => {
      const stack = []
      let currentPanel = null

      const callbacks = {
        getInput: (id, config) => {
          currentPanel.addInput(id, config)
          return true
        },
        startUi: (id, config) => {
          currentPanel = new PanelBuilder({ id, config, onRun })
        },
        endUi: () => {
          stack.push(currentPanel)
        }
      }

      const processingErrors = await processSpec({ spec, artifacts }, callbacks)

      setProcessedResult({
        panels: stack,
        errors: processingErrors
      })
    })()
  }, [ onRun, spec, artifacts ])

  return (
    <Layout>
      {(!network) ? <div>Waiting for Ethereum network connection</div> : (
        <Container>
          <NetworkInfo network={network} />
          {(!processedResult) ? <div>Loading...</div> : (
            <Panels>
              {processedResult.errors.length ? <Error error={processedResult.errors} /> : (
                processedResult.panels.map(panel => (
                  <PanelContainer key={panel.id}>
                    {panel.buildContent()}
                  </PanelContainer>
                ))
              )}
            </Panels>
          )}
        </Container>
      )}
    </Layout>
  )
}
