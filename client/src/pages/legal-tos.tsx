import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function LegalTos() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Legal & Terms of Service</h1>
        <p className="text-muted-foreground">
          Terms of service and privacy policy for SoulSync Connect
        </p>
      </div>

      {/* Important Disclaimer */}
      <Card className="border-chart-4">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <i className="fas fa-exclamation-triangle text-chart-4"></i>
            <span>Third-Party Service Notice</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            SoulSync Connect integrates with third-party APIs (Kindroid, ElevenLabs, Twilio, Spotify). You are responsible 
            for compliance with each service's terms of use and applicable charges. This application facilitates connections 
            to these services but does not control their functionality, availability, or pricing.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Terms of Service */}
        <Card>
          <CardHeader>
            <CardTitle>Terms of Service</CardTitle>
            <p className="text-sm text-muted-foreground">Effective Date: September 3, 2025</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">1. Acceptance of Terms</h4>
              <p className="text-sm text-muted-foreground">
                By using SoulSync Connect, you agree to these Terms of Service and acknowledge that you understand 
                the responsibilities and limitations outlined herein. These terms may be updated periodically.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">2. Third-Party Services</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>Kindroid:</strong> AI companion services and conversational AI</li>
                <li>• <strong>ElevenLabs:</strong> Text-to-speech and voice synthesis</li>
                <li>• <strong>Twilio:</strong> Voice calling and SMS messaging services</li>
                <li>• <strong>Spotify:</strong> Music streaming and playlist integration</li>
              </ul>
              <p className="text-sm text-muted-foreground mt-2">
                You are responsible for maintaining accounts with these services and complying with their respective terms.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">3. API Usage & Costs</h4>
              <p className="text-sm text-muted-foreground">
                All API usage charges from third-party services are your responsibility. SoulSync Connect does not 
                include or cover costs from Kindroid, ElevenLabs, Twilio, or Spotify. Monitor your usage to avoid 
                unexpected charges.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">4. User Responsibilities</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Secure storage of API credentials</li>
                <li>• Monitoring of third-party service usage and costs</li>
                <li>• Compliance with all applicable laws and regulations</li>
                <li>• Appropriate use of AI companions and voice services</li>
                <li>• Respect for content policies of integrated services</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">5. Data Handling</h4>
              <p className="text-sm text-muted-foreground">
                Your API credentials are encrypted using AES-256 encryption before storage. Conversation logs, 
                call records, and shared files are stored securely. You maintain control over your data and 
                can delete it at any time through the application interface.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">6. Limitations of Liability</h4>
              <p className="text-sm text-muted-foreground">
                SoulSync Connect is provided "as is" without warranties. We are not liable for service interruptions, 
                third-party API failures, data loss, or charges incurred from third-party services. Use at your own risk.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">7. Content & Conduct</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Do not use the service for illegal activities</li>
                <li>• Respect intellectual property rights</li>
                <li>• Do not attempt to reverse engineer or exploit the system</li>
                <li>• Follow community guidelines when sharing content</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">8. SMS Consent & Text Messaging</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <strong>By using the SMS management features, you expressly consent to receive text messages from SoulSync Connect.</strong> 
                  This includes but is not limited to:
                </p>
                <ul className="space-y-1 pl-4">
                  <li>• SMS commands for bot control and management</li>
                  <li>• System notifications and status updates</li>
                  <li>• Error alerts and diagnostic messages</li>
                  <li>• Confirmation messages for SMS-triggered actions</li>
                </ul>
                <p>
                  Message and data rates may apply according to your mobile carrier's plan. You can opt out of SMS messages 
                  at any time by disabling the SMS management feature in your settings or by texting "STOP" to our SMS number. 
                  Standard messaging rates apply as determined by your wireless service provider.
                </p>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">9. Service Availability</h4>
              <p className="text-sm text-muted-foreground">
                While we strive for high availability, SoulSync Connect depends on third-party services. We cannot 
                guarantee 100% uptime and are not responsible for outages caused by external service providers.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">10. Termination</h4>
              <p className="text-sm text-muted-foreground">
                You may stop using SoulSync Connect at any time. We reserve the right to suspend access for 
                violations of these terms. Upon termination, you should revoke API access from your third-party accounts.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">11. Changes to Terms</h4>
              <p className="text-sm text-muted-foreground">
                These terms may be updated to reflect changes in functionality or legal requirements. Continued use 
                constitutes acceptance of updated terms.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Privacy Policy */}
        <Card>
          <CardHeader>
            <CardTitle>Privacy Policy</CardTitle>
            <p className="text-sm text-muted-foreground">Effective Date: September 3, 2025</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Information We Collect</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>API Credentials:</strong> Encrypted storage of third-party service keys</li>
                <li>• <strong>Call Records:</strong> Call duration, status, and quality metrics</li>
                <li>• <strong>Error Logs:</strong> System diagnostics and troubleshooting data</li>
                <li>• <strong>Shared Files:</strong> Files you upload for companion interactions</li>
                <li>• <strong>Usage Metrics:</strong> Performance and system health data</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">How We Protect Your Data</h4>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div>
                  <p className="font-medium">Encryption</p>
                  <p>All API keys are encrypted using AES-256 encryption before storage. Data transmission uses HTTPS/TLS.</p>
                </div>
                <div>
                  <p className="font-medium">Access Control</p>
                  <p>Your data is isolated and accessible only through your authenticated session.</p>
                </div>
                <div>
                  <p className="font-medium">Regular Security Audits</p>
                  <p>We perform regular security reviews and updates to protect your information.</p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Data Sharing</h4>
              <p className="text-sm text-muted-foreground">
                We do not sell, trade, or share your personal data with third parties except as necessary to provide 
                the service (API calls to configured services) or as required by law. Your interactions with AI companions 
                are processed by Kindroid according to their privacy policy.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Third-Party Services</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p><strong>Kindroid:</strong> Processes conversation data to provide AI companion responses</p>
                <p><strong>ElevenLabs:</strong> Converts text to speech for voice interactions</p>
                <p><strong>Twilio:</strong> Handles voice calls and SMS messaging</p>
                <p><strong>Spotify:</strong> Accesses your music library for sharing features</p>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Each service has its own privacy policy governing how they handle your data.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Data Retention</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Call logs: Retained for 90 days for quality and billing purposes</li>
                <li>• Error logs: Retained for 30 days for troubleshooting</li>
                <li>• Shared files: Retained until manually deleted</li>
                <li>• API credentials: Retained until account deletion</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Your Rights</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Access your stored data through the application interface</li>
                <li>• Delete your data at any time</li>
                <li>• Export your data in standard formats</li>
                <li>• Revoke API access from third-party services</li>
                <li>• Request clarification about data handling practices</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Cookies & Tracking</h4>
              <p className="text-sm text-muted-foreground">
                SoulSync Connect uses essential cookies for authentication and session management. We do not use 
                tracking cookies or analytics that identify individual users.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Contact & Support</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p><strong>Technical Support:</strong> Use the diagnostics panel for system issues</p>
                <p><strong>Data Questions:</strong> Access your data through the application interface</p>
                <p><strong>Privacy Concerns:</strong> Review and update your settings in the application</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contact & Support */}
      <Card>
        <CardHeader>
          <CardTitle>Contact & Support</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <i className="fas fa-life-ring text-2xl text-primary mb-2"></i>
              <h4 className="font-semibold mb-1">Technical Support</h4>
              <p className="text-sm text-muted-foreground">
                For setup questions and technical issues, check the Setup Guide and Diagnostics panels first.
              </p>
            </div>
            
            <div className="text-center">
              <i className="fas fa-shield-alt text-2xl text-primary mb-2"></i>
              <h4 className="font-semibold mb-1">Security Questions</h4>
              <p className="text-sm text-muted-foreground">
                Your data is encrypted and secure. Use the API Credentials panel to manage your service connections.
              </p>
            </div>
            
            <div className="text-center">
              <i className="fas fa-book text-2xl text-primary mb-2"></i>
              <h4 className="font-semibold mb-1">Documentation</h4>
              <p className="text-sm text-muted-foreground">
                Refer to individual service documentation for detailed API usage and billing information.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Consent */}
      <Card className="border-chart-2">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <i className="fas fa-user-check text-chart-2"></i>
            <span>User Consent</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              I acknowledge that SoulSync Connect is not affiliated with Kindroid, ElevenLabs, Twilio, or Spotify. 
              These are independent services with their own terms, pricing, and policies. I understand that:
            </p>
            
            <ul className="text-sm text-muted-foreground space-y-1 pl-4">
              <li>• I am responsible for all charges from third-party services</li>
              <li>• I will comply with each service's terms of use</li>
              <li>• My API credentials are stored securely but I'm responsible for their management</li>
              <li>• Service availability depends on third-party providers</li>
              <li>• I can delete my data and revoke access at any time</li>
              <li>• <strong>I consent to receive text messages from SoulSync when using SMS features</strong></li>
            </ul>
            
            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground">
                <strong>Last Updated:</strong> September 3, 2025. By continuing to use SoulSync Connect, 
                you agree to these terms and our privacy policy.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
