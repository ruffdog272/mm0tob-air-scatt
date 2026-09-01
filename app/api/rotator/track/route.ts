import net from "node:net"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ROTCTLD_HOST = "127.0.0.1"
const ROTCTLD_PORT = 4533
const SOCKET_TIMEOUT_MS = 2500

type TrackPayload = { az?: unknown; el?: unknown }

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function sendPosition(az: number, el: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: ROTCTLD_HOST, port: ROTCTLD_PORT })
    let settled = false

    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      socket.destroy()
      error ? reject(error) : resolve()
    }

    socket.setTimeout(SOCKET_TIMEOUT_MS)
    socket.once("connect", () => {
      socket.write(`P ${az} ${el}\n`, (error) => {
        if (error) finish(error)
        else finish()
      })
    })
    socket.once("timeout", () => finish(new Error("rotctld connection timed out")))
    socket.once("error", (error) => finish(error))
  })
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  let body: TrackPayload = {}

  try {
    body = (await request.json()) as TrackPayload
  } catch {
    // Query parameters are also supported, so an empty or non-JSON body is okay.
  }

  const az = Number(searchParams.get("az") ?? body.az)
  const el = Number(searchParams.get("el") ?? body.el)

  if (!finiteNumber(az) || !finiteNumber(el)) {
    return NextResponse.json({ error: "az and el must be finite numbers" }, { status: 400 })
  }

  try {
    await sendPosition(az, el)
    return NextResponse.json({ ok: true, az, el })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "rotctld unavailable" },
      { status: 502 },
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

export const __test = { ROTCTLD_HOST, ROTCTLD_PORT }
  
