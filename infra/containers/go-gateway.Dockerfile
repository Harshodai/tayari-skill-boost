# syntax=docker/dockerfile:1.7

FROM golang:1.25-alpine AS builder
WORKDIR /src

COPY backend/go/go.mod backend/go/go.sum ./
RUN go mod download

COPY backend/go/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags='-s -w' -o /out/tayari-gateway ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app

COPY --from=builder /out/tayari-gateway /app/tayari-gateway

USER nonroot:nonroot
EXPOSE 8080

ENTRYPOINT ["/app/tayari-gateway"]
