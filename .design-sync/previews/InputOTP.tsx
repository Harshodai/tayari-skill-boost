import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';

export function Empty() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Label htmlFor="otp-empty">Enter the 6-digit code sent to your email</Label>
      <InputOTP id="otp-empty" maxLength={6}>
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          <InputOTPSlot index={3} />
          <InputOTPSlot index={4} />
          <InputOTPSlot index={5} />
        </InputOTPGroup>
      </InputOTP>
    </div>
  );
}

export function PartiallyFilled() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Label htmlFor="otp-partial">Verify it&apos;s you — code sent to k***a@gmail.com</Label>
      <InputOTP id="otp-partial" maxLength={6} defaultValue="248">
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
          <InputOTPSlot index={3} />
          <InputOTPSlot index={4} />
          <InputOTPSlot index={5} />
        </InputOTPGroup>
      </InputOTP>
    </div>
  );
}

export function Disabled() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Label htmlFor="otp-disabled" className="opacity-70">
        Code expired — request a new one
      </Label>
      <InputOTP id="otp-disabled" maxLength={6} disabled>
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
          <InputOTPSlot index={3} />
          <InputOTPSlot index={4} />
          <InputOTPSlot index={5} />
        </InputOTPGroup>
      </InputOTP>
    </div>
  );
}
