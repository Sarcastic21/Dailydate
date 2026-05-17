import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Footer from '../components/Footer';

const LegalTerms = () => {
    useEffect(() => { window.scrollTo(0, 0); }, []);
    const [openIdx, setOpenIdx] = useState(null);

    const terms = [
        {
            title: "1. Acceptance of Terms",
            content: `This website and the DailyDate mobile application are operated by DailyDate ("DailyDate", "we", "us", "our"), with its office at Mau, Uttar Pradesh – 275101, India. By downloading, accessing, registering, or using the DailyDate platform (the "App" or "Website"), you ("User", "you", "your") confirm that you have read, understood, and agree to be bound by these Terms & Conditions ("Terms"). These Terms form an agreement between you and DailyDate. If you do not agree to these Terms, you must not install, access, or use the App or Website. We reserve the right to amend or update these Terms at any time. Continued use of the platform after any change means you accept the updated Terms.`
        },
        {
            title: "2. About DailyDate & Business Description",
            content: `DailyDate is an online dating and social connection platform that allows registered users to create personal profiles, discover compatible matches, and communicate through in-app messaging. Users may access basic features for free and may purchase premium subscription plans to unlock advanced features such as unlimited likes, priority messaging, and premium search filters.\n\nDailyDate is not a matrimonial service and does not guarantee any romantic outcomes. All interactions on the platform are between independent adult users, and DailyDate serves solely as a technology intermediary.`
        },
        {
            title: "3. Eligibility",
            content: `To register and use DailyDate, you must:\n\n(a) Be at least 18 years of age at the time of registration;\n(b) Be legally single, divorced, widowed, or in a relationship structure that explicitly permits participation in a dating platform;\n(c) Not have been convicted of any felony, violent crime, sexual offense, stalking, harassment, fraud, or similar offences;\n(d) Not be required to register as a sex offender with any government entity;\n(e) Not have been previously banned or permanently suspended from DailyDate or any similar platform for community violations;\n(f) Be a resident or citizen of India or any jurisdiction where use of the platform is not prohibited by applicable law.\n\nBy creating an account, you represent and warrant that all of the above conditions are met. DailyDate reserves the right to verify eligibility at any time and to suspend or terminate accounts found to be in violation.`
        },
        {
            title: "4. Mobile Number Verification (OTP)",
            content: `DailyDate uses One-Time Password (OTP) verification via SMS to authenticate users and prevent fake or duplicate accounts. Upon registration, a unique numeric OTP will be sent to the mobile number provided by you. You must enter this OTP to activate your account.\n\nBy completing OTP verification, you confirm that:\n(a) You are the legitimate owner or authorised user of the registered mobile number;\n(b) You will not use virtual, temporary, or borrowed phone numbers;\n(c) Each mobile number may only be linked to one active DailyDate account.\n\nYour mobile number is used exclusively for verification, account recovery, and security alerts, and is never displayed to other users. DailyDate will never request your OTP through chat, email, or phone calls. If you receive an unsolicited OTP, do not share it with anyone and contact support immediately.`
        },
        {
            title: "5. User Account & Security",
            content: `You are solely responsible for maintaining the confidentiality of your account credentials. You agree to:\n\n(a) Use a strong, unique password and not share it with any third party;\n(b) Log out of shared or public devices after each session;\n(c) Notify DailyDate immediately at dailydateapp@gmail.com if you suspect unauthorised access to your account;\n(d) Not create multiple accounts using different phone numbers or email addresses.\n\nDailyDate shall not be liable for any loss or damage arising from unauthorised account access resulting from your failure to maintain account security.`
        },
        {
            title: "6. Premium Subscription Plans & Payments",
            content: `DailyDate offers a free tier with limited features and paid premium subscription plans. Premium features include, but are not limited to: unlimited swipes and likes, see who liked your profile, read receipts, advanced match filters, and priority messaging.\n\nSubscription Details:\n• Plans are offered on a monthly, quarterly, or annual billing cycle.\n• All payments are processed through secure, RBI-compliant third-party payment systems including Google Play Billing, and may support UPI, credit/debit cards, and net banking.\n• Subscriptions auto-renew at the end of each billing cycle unless cancelled at least 24 hours before the renewal date.\n• Prices are displayed in Indian Rupees (INR) and are inclusive of applicable taxes (GST).\n• Subscription pricing is subject to change with 30 days' prior notice to existing subscribers.\n\nBy subscribing to a premium plan, you authorise DailyDate to charge the applicable fee to your selected payment method at each renewal cycle.`
        },
        {
            title: "7. Return, Refund & Dispute Policy",
            content: `DailyDate provides fully digital services. All premium subscriptions are activated immediately upon successful payment confirmation.\n\nRefund Policy:\n• DailyDate operates a strict No Refund Policy. Once a subscription has been activated or in-app credits have been applied to your account, the services are considered delivered and consumed, and no refund will be issued. No cancellation will be allowed once the subscription is activated.\n• In cases of duplicate payment or technical failure where premium features are not activated within 48 hours of payment, a refund request may be submitted to dailydateapp@gmail.com within 7 calendar days of the transaction.\n• Approved refunds will be credited to the original payment method (bank account, card, or UPI ID) within 5–7 business working days from the date of approval.\n• Refund requests submitted beyond the 7-day window will not be considered under any circumstances.\n• No refunds will be issued for account suspensions or terminations due to violations of these Terms.\n\nDispute Resolution:\nFor payment disputes, please first contact us at dailydateapp@gmail.com with your transaction ID, registered mobile number, and a description of the issue. We will investigate and respond within 48 hours.`
        },
        {
            title: "8. Cancellation Policy",
            content: `You may cancel your premium subscription at any time through the Account Settings section of the app or website.\n\nCancellation Terms:\n• To avoid being charged for the next billing cycle, cancellation must be completed at least 24 hours before your scheduled renewal date.\n• Upon cancellation, your premium access remains active until the end of the current paid billing period. After that, your account reverts to the free membership tier automatically.\n• Cancellation does not entitle you to a pro-rated refund for any unused portion of your current billing cycle.\n• If your subscription was purchased through the Apple App Store or Google Play Store, cancellation must be managed through your respective app store account settings.\n\nDailyDate also reserves the right to cancel or suspend any subscription without refund if you are found to be in violation of these Terms or the Community Guidelines.`
        },
        {
            title: "9. Shipping & Delivery Policy",
            content: `DailyDate is an entirely digital platform. All premium subscription features are activated digitally and immediately upon successful payment confirmation from the payment gateway. In rare cases of network delays, activation may take up to 24 hours. If premium features are not activated within 24 hours, please contact us at dailydateapp@gmail.com with your transaction reference number.`
        },
        {
            title: "10. Zero-Tolerance Anti-Harassment Policy",
            content: `DailyDate is committed to maintaining a safe, respectful, and harassment-free environment. We enforce a strict zero-tolerance policy against:\n\n• Any form of harassment, bullying, threats, intimidation, or verbal abuse;\n• Sending unsolicited explicit content, nude or lewd images, or sexually aggressive messages;\n• Hate speech or discriminatory remarks based on race, religion, gender, sexual orientation, disability, caste, or nationality;\n• Cyberstalking, blackmail, or coercive behaviour;\n• Spamming, phishing, or attempting to extract personal or financial information from other users.\n\nAll chat messages are subject to automated AI-based monitoring and may be reviewed by human moderators when reported. Violations will result in immediate suspension or permanent ban, forfeiture of any active subscription fees (with no refund), and may be reported to law enforcement authorities where required by law.\n\nUsers may use the in-app "Block & Report" feature available on every profile and chat window.`
        },
        {
            title: "11. Prohibited Conduct & Content Standards",
            content: `You agree not to:\n\n(a) Use the platform for any commercial purpose, including advertising, soliciting escort services, or requesting money from other users;\n(b) Impersonate any person, create fake profiles, or misrepresent your identity;\n(c) Upload content that is defamatory, fraudulent, obscene, pornographic, violent, or otherwise unlawful;\n(d) Use automated scripts, or scraping tools to interact with the platform;\n(e) Collect, harvest, or store other users' personal information without their explicit consent;\n(f) Share external personal contact details (phone number, email, social handles) in your profile bio or within the first 10 mutual message exchanges, as a safety measure;\n(g) Attempt to reverse-engineer, decompile, or tamper with the App's source code or infrastructure;\n(h) Create multiple accounts using different phone numbers to evade a ban or circumvent platform restrictions.\n\nDailyDate reserves the right to remove any content or suspend any account that violates these standards, with or without prior notice.`
        },
        {
            title: "12. In-Person Meeting Safety Disclaimer",
            content: `While DailyDate verifies mobile numbers to reduce fake accounts, we do not conduct criminal background checks or guarantee the identity, intent, or behaviour of any user. Any in-person meeting arranged through the app is undertaken entirely at your own risk.\n\nWe strongly advise all users to:\n• Meet only in public, well-lit locations;\n• Inform a trusted friend or family member of your plans, including the other person's name and profile details;\n• Arrange your own transportation to and from the meeting;\n• Never share your home or work address until you feel completely safe;\n• Trust your instincts — if something feels wrong, leave immediately and report the user via the in-app tool.\n\nDailyDate shall not be held liable for any injury, emotional distress, financial loss, or any other damage arising from in-person meetings, dates, or interactions that originate through the platform. You assume all risks associated with meeting other users in person.`
        },
        {
            title: "13. Intellectual Property",
            content: `All content, design, graphics, logos, trademarks, software, and other proprietary material on the DailyDate platform is owned by or licensed to DailyDate and is protected under applicable copyright, trademark, and intellectual property laws of India and international conventions. The name "DailyDate" is a registered trademark.\n\nYou are granted a limited, non-exclusive, non-transferable, revocable licence to access and use the platform for personal, non-commercial purposes only. You may not copy, reproduce, modify, distribute, or create derivative works from any part of the platform without express written consent from DailyDate.\n\nAny content you upload to the platform (photos, bio, messages) remains your property. However, you grant DailyDate a worldwide, non-exclusive, royalty-free licence to host, store, display, and use that content solely for the purpose of operating the platform and providing services to you.`
        },
        {
            title: "14. Termination & Account Suspension",
            content: `DailyDate reserves the right to suspend or permanently terminate your account at any time, with or without notice, if:\n\n(a) You have violated these Terms or the Community Guidelines;\n(b) A credible complaint has been received about your conduct from another user;\n(c) Suspicious, fraudulent, or abusive activity is detected from your account;\n(d) We are legally required to do so by a court, government authority, or law enforcement agency.\n\nYou may delete your account at any time via Account Settings. Upon deletion, your profile and all associated data will be permanently removed from our active databases within 48 hours, except where retention is required for legal compliance (e.g., records related to abuse reports, disputes, or pending legal proceedings). No refund will be issued for the remaining portion of any paid subscription upon termination for cause.`
        },
        {
            title: "15. Disclaimers & Limitation of Liability",
            content: `THE PLATFORM IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT ANY WARRANTY OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.\n\nDailyDate does not warrant that: (a) the platform will be uninterrupted, error-free, or free of viruses; (b) any match or connection made through the platform will result in a desired romantic outcome; (c) all user-submitted content is accurate or genuine.\n\nTo the maximum extent permitted by applicable law, DailyDate, its founders, officers, employees, and affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including emotional distress, loss of data, or personal injury, arising from your use of the platform. Our total aggregate liability to you shall not exceed the amount paid by you to DailyDate in the three (3) months immediately preceding the claim, or ₹500 (Indian Rupees Five Hundred Only), whichever is lower.`
        },
        {
            title: "16. Governing Law & Dispute Resolution",
            content: `These Terms shall be governed by and construed in accordance with the laws of India. Any dispute, claim, or controversy arising from or relating to these Terms or your use of the platform shall first be attempted to be resolved through good-faith negotiation within 30 days of written notice.\n\nIf unresolved, the dispute shall be submitted to binding arbitration under the Arbitration and Conciliation Act, 1996, with a sole arbitrator mutually appointed. The seat of arbitration shall be Mau, Uttar Pradesh, India. The language of arbitration shall be English or Hindi. You agree to waive any right to participate in class-action proceedings against DailyDate.`
        },
        {
            title: "17. Contact Information",
            content: `For any queries, complaints, legal notices, or regulatory communications, please contact us at:\n\nRegistered Office: Mau, Uttar Pradesh – 275101, India\nLegal & Compliance: dailydateapp@gmail.com\nTrust & Safety (24/7): dailydateapp@gmail.com\nGeneral Support: dailydateapp@gmail.com\n\nLead Contact: DailyDate Team\nEmail: dailydateapp@gmail.com\nAddress: Mau, Uttar Pradesh – 275101, India\nResponse Time: Within 24-48 hours of receipt.`
        }
    ];

    return (
        <div className="min-h-screen bg-white text-zinc-900 font-sans selection:bg-orange-500/10 pt-[72px]">
            <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-40">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full opacity-10 blur-[120px]"
                    style={{ background: 'radial-gradient(circle, #f97316 0%, transparent 70%)' }} />
                <div className="absolute bottom-[-10%] right-[-5%] w-[30%] h-[30%] rounded-full opacity-5 blur-[100px]"
                    style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }} />
            </div>

            <div className="relative z-10 max-w-4xl mx-auto px-6 py-20 lg:py-32">
                <header className="mb-16">
                    <Link to="/" className="inline-flex items-center gap-2 text-zinc-500 hover:text-orange-500 transition-colors mb-12 group">
                        <span className="text-lg group-hover:-translate-x-1 transition-transform">←</span>
                        <span className="text-sm font-medium">Back to DailyDate</span>
                    </Link>



                    <h1 className="font-serif text-5xl lg:text-7xl font-black mb-4 tracking-tight">
                        Terms &amp; <br />
                        <span className="text-orange-500 italic text-4xl lg:text-6xl uppercase tracking-widest">Conditions.</span>
                    </h1>
                    <p className="text-zinc-400 text-sm leading-relaxed font-light max-w-2xl mb-6">
                        Effective Date: January 1, 2025 &nbsp;|&nbsp; Last Updated: May 9, 2026
                    </p>
                    <p className="text-zinc-500 text-sm leading-relaxed max-w-2xl mb-6">
                        This website is operated by <strong>DailyDate</strong>, having its office at Mau, Uttar Pradesh – 275101, India. Please read these Terms carefully before using our services.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <div className="bg-orange-500/10 border border-orange-500/20 rounded-full px-4 py-1.5 text-xs font-mono text-orange-500">📱 OTP Verified Platform</div>
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 text-xs font-mono text-blue-500">🛡️ Zero-Tolerance Policy</div>
                        <div className="bg-green-500/10 border border-green-500/20 rounded-full px-4 py-1.5 text-xs font-mono text-green-600">🔐 Privacy Protected</div>
                    </div>
                </header>

                <div className="space-y-12 mb-24">
                    {terms.map((term, idx) => (
                        <section key={idx} className="scroll-mt-32">
                            <h2 className="text-xl lg:text-3xl font-serif font-black mb-6 text-zinc-900 border-l-4 border-orange-500 pl-6 leading-tight">
                                {term.title}
                            </h2>
                            <p className="text-zinc-500 leading-relaxed text-sm lg:text-[16px] font-light whitespace-pre-line">
                                {term.content}
                            </p>
                        </section>
                    ))}
                </div>

                {/* Summary badges */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-16">
                    {[
                        { icon: '🚫', label: 'No Refund Policy', sub: 'No Cancellation' },
                        { icon: '⏱️', label: 'Fast Support', sub: '48h Response' },
                        { icon: '⚡', label: 'Instant Activation', sub: 'Post payment' },
                        { icon: '📍', label: 'India Based', sub: 'Mau, UP' },
                    ].map((b, i) => (
                        <div key={i} className="bg-zinc-50 border border-zinc-100 rounded-xl p-4 text-center">
                            <div className="text-2xl mb-1">{b.icon}</div>
                            <div className="text-xs font-bold text-zinc-800">{b.label}</div>
                            <div className="text-[10px] text-zinc-400 mt-0.5">{b.sub}</div>
                        </div>
                    ))}
                </div>

                <div className="border-t border-zinc-100 pt-8 text-center text-zinc-400 text-xs space-y-1">
                    <p className="font-bold text-zinc-700">© 2026 DailyDate. All rights reserved.</p>
                    <p>Mau, Uttar Pradesh – 275101, India</p>
                    <p className="opacity-50">Last updated: May 9, 2026</p>
                </div>
            </div>
            <Footer />
        </div>
    );
};

export default LegalTerms;
