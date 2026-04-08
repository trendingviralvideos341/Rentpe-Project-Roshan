'use client';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { resetPassword } from '@/actions/auth';
import { toast } from 'sonner';

function ResetPasswordForm() {
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    if (!token) {
        return (
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
                <h1 style={{ color: '#dc2626', fontSize: '22px', fontWeight: 900, margin: '0 0 12px' }}>
                    Invalid Reset Link
                </h1>
                <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>
                    This link is invalid or has already expired.
                </p>
                <a href="/auth/forgot-password" style={{
                    display: 'inline-block',
                    background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                    color: '#fff',
                    padding: '12px 28px',
                    borderRadius: '10px',
                    fontWeight: 700,
                    textDecoration: 'none',
                    fontSize: '14px'
                }}>
                    Request a New Link
                </a>
            </div>
        );
    }

    if (success) {
        return (
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '56px', marginBottom: '16px' }}>✅</div>
                <h1 style={{ color: '#1e293b', fontSize: '22px', fontWeight: 900, margin: '0 0 12px' }}>
                    Password Reset!
                </h1>
                <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '28px' }}>
                    Your password has been updated successfully. You can now sign in.
                </p>
                <a href="/login" style={{
                    display: 'block',
                    background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                    color: '#fff',
                    padding: '14px',
                    borderRadius: '12px',
                    fontWeight: 800,
                    textDecoration: 'none',
                    fontSize: '15px',
                    textAlign: 'center',
                }}>
                    Sign In Now →
                </a>
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData(e.currentTarget);
        formData.append('token', token);
        const result = await resetPassword(formData);
        setLoading(false);
        if (result.error) {
            toast.error(result.error);
        } else {
            setSuccess(true);
            toast.success('Password reset successfully!');
        }
    };

    return (
        <>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔑</div>
                <h1 style={{ color: '#1e293b', fontSize: '22px', fontWeight: 900, margin: '0 0 8px' }}>
                    Set New Password
                </h1>
                <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
                    Choose a strong password for your account.
                </p>
            </div>

            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
                        New Password
                    </label>
                    <div style={{ position: 'relative' }}>
                        <input
                            name="newPassword"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Min 8 chars, 1 uppercase, 1 number"
                            required
                            style={{
                                width: '100%',
                                height: '48px',
                                padding: '0 56px 0 14px',
                                border: '1.5px solid #e2e8f0',
                                borderRadius: '10px',
                                fontSize: '15px',
                                outline: 'none',
                                boxSizing: 'border-box',
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            style={{
                                position: 'absolute',
                                right: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#94a3b8',
                            }}
                        >
                            {showPassword ? 'HIDE' : 'SHOW'}
                        </button>
                    </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
                        Confirm Password
                    </label>
                    <input
                        name="confirmPassword"
                        type="password"
                        placeholder="Re-enter your new password"
                        required
                        style={{
                            width: '100%',
                            height: '48px',
                            padding: '0 14px',
                            border: '1.5px solid #e2e8f0',
                            borderRadius: '10px',
                            fontSize: '15px',
                            outline: 'none',
                            boxSizing: 'border-box',
                        }}
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    style={{
                        width: '100%',
                        height: '48px',
                        background: loading ? '#a78bfa' : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '15px',
                        fontWeight: 800,
                        cursor: loading ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                    }}
                >
                    {loading ? 'Resetting...' : 'Reset Password →'}
                </button>
            </form>

            <div style={{
                marginTop: '20px',
                padding: '12px 14px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '10px',
                fontSize: '12px',
                color: '#166534'
            }}>
                ✅ Use: 8+ characters · 1 uppercase · 1 lowercase · 1 number
            </div>
        </>
    );
}

export default function ResetPasswordPage() {
    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #ede9fe 0%, #dbeafe 100%)',
            padding: '24px'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '440px',
                background: '#ffffff',
                borderRadius: '20px',
                boxShadow: '0 8px 40px rgba(88,28,235,0.10)',
                border: '1px solid #ede9fe',
                padding: '40px 36px'
            }}>
                <Suspense fallback={
                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>
                        Loading...
                    </div>
                }>
                    <ResetPasswordForm />
                </Suspense>
            </div>
        </div>
    );
}
