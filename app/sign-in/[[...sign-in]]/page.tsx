import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center gap-4 overflow-y-auto px-6 py-8">
      <p className="max-w-sm text-center text-sm text-black/60 dark:text-white/60">
        Sau khi đăng nhập, hãy nhập tên tổ chức hoặc mã số thuế để gắn tài khoản vào đúng công ty.
      </p>
      <SignIn />
    </div>
  );
}
