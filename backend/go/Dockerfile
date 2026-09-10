FROM golang:alpine AS builder

WORKDIR /app

ENV GOTOOLCHAIN=auto

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o server ./cmd/server

# Production image
FROM alpine:3.20

RUN apk add --no-cache ca-certificates

RUN addgroup -g 1001 -S app && adduser -S app -u 1001 -G app

WORKDIR /app
COPY --from=builder --chown=app:app /app/server .

USER app
EXPOSE 8080

CMD ["./server"]
