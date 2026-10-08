import { Router, type RequestHandler } from 'express'
import { GmailService } from '../services/gmail.service'
import { deliveryError, sendApprovedFollowUp, sendApprovedOutreach } from '../services/outreach-delivery.service'

export const gmailRouter = Router()

/** Google's redirect is public, but a one-use state created by the authenticated owner is mandatory. */
export const gmailOAuthCallback: RequestHandler = async (req, res) => {
  try {
    await GmailService.completeAuthorization(req.query.state, req.query.code)
    return res.redirect(303, `${process.env.FRONTEND_URL || 'http://localhost:3000'}/integrations?gmail=connected`)
  } catch {
    return res.redirect(303, `${process.env.FRONTEND_URL || 'http://localhost:3000'}/integrations?gmail=error`)
  }
}

gmailRouter.get('/status', async (_req, res) => res.json(await GmailService.status()))
gmailRouter.get('/oauth/start', async (_req, res) => {
  try { return res.json({ authorizationUrl: await GmailService.authorizationUrl() }) }
  catch (error) { const result = deliveryError(error); return res.status(result.status).json({ error: result.error }) }
})
gmailRouter.post('/disconnect', async (_req, res) => {
  try { return res.json(await GmailService.disconnect()) }
  catch (error) { const result = deliveryError(error); return res.status(result.status).json({ error: result.error }) }
})
gmailRouter.post('/outreach/:id/send', async (req, res) => {
  try { return res.json(await sendApprovedOutreach(req.params.id, req.body?.expectedUpdatedAt, req.body?.confirmed)) }
  catch (error) { const result = deliveryError(error); return res.status(result.status).json({ error: result.error }) }
})
gmailRouter.post('/follow-up-sequences/:id/steps/:step/send', async (req, res) => {
  try { return res.json(await sendApprovedFollowUp(req.params.id, Number(req.params.step), req.body?.expectedUpdatedAt, req.body?.confirmed)) }
  catch (error) { const result = deliveryError(error); return res.status(result.status).json({ error: result.error }) }
})
