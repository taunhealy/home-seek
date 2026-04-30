import datetime as dt

def get_base_styles():
    return """
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        background-color: #0A0A0A;
        color: #FFFFFF;
        padding: 40px 20px;
        line-height: 1.6;
    """

def wrap_content(content):
    return f"""
    <div style="{get_base_styles()}">
        <div style="max-width: 600px; margin: 0 auto; background-color: #111111; border: 1px solid rgba(255,255,255,0.05); border-radius: 32px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.4);">
            <!-- Header -->
            <div style="padding: 40px 40px 20px 40px; text-align: center;">
                <div style="font-size: 10px; font-weight: 900; color: #10B981; text-transform: uppercase; letter-spacing: 0.4em; margin-bottom: 8px;">HomeSeek Intelligence</div>
                <div style="width: 40px; height: 2px; background: linear-gradient(90deg, transparent, #10B981, transparent); margin: 0 auto;"></div>
            </div>
            
            {content}
            
            <!-- Footer -->
            <div style="padding: 40px; text-align: center; border-top: 1px solid rgba(255,255,255,0.05); background-color: rgba(255,255,255,0.01);">
                <p style="font-size: 10px; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 0.2em; margin: 0;">This intelligence was gathered autonomously by the HomeSeek Sniper Engine.</p>
                <div style="margin-top: 20px; font-size: 11px;">
                    <a href="https://home-seek.vercel.app/discover" style="color: #10B981; text-decoration: none; font-weight: 700;">Manage Alerts</a>
                    <span style="color: rgba(255,255,255,0.1); margin: 0 10px;">|</span>
                    <a href="https://home-seek.vercel.app/profile" style="color: rgba(255,255,255,0.4); text-decoration: none;">Account Settings</a>
                </div>
            </div>
        </div>
    </div>
    """

def get_match_template(listing):
    price_display = f"R{listing.get('price', 0):,}" if listing.get('price') else "Price on Request"
    return wrap_content(f"""
        <div style="padding: 0 40px 40px 40px;">
            <h1 style="font-size: 28px; font-weight: 900; margin: 0 0 8px 0; letter-spacing: -0.03em; color: #FFFFFF;">{listing.get('title')}</h1>
            <div style="font-size: 24px; font-weight: 900; color: #10B981; margin-bottom: 24px;">{price_display}</div>
            
            <div style="background-color: rgba(255,255,255,0.03); border-radius: 20px; padding: 24px; margin-bottom: 32px; border: 1px solid rgba(255,255,255,0.1);">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div style="margin-bottom: 15px;">
                        <span style="font-size: 10px; font-weight: 800; color: #BBBBBB; text-transform: uppercase; letter-spacing: 0.1em; display: block; margin-bottom: 4px;">Neighborhood</span>
                        <span style="font-size: 15px; font-weight: 700; color: #FFFFFF;">{listing.get('address', 'Cape Town')}</span>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <span style="font-size: 10px; font-weight: 800; color: #BBBBBB; text-transform: uppercase; letter-spacing: 0.1em; display: block; margin-bottom: 4px;">Category</span>
                        <span style="font-size: 15px; font-weight: 700; color: #FFFFFF;">{listing.get('property_type', 'Residential')} ({listing.get('property_sub_type', 'Whole')})</span>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <span style="font-size: 10px; font-weight: 800; color: #BBBBBB; text-transform: uppercase; letter-spacing: 0.1em; display: block; margin-bottom: 4px;">Specs</span>
                        <span style="font-size: 15px; font-weight: 700; color: #FFFFFF;">{listing.get('bedrooms', 'N/A')} Beds | {listing.get('bathrooms', 'N/A')} Baths</span>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <span style="font-size: 10px; font-weight: 800; color: #BBBBBB; text-transform: uppercase; letter-spacing: 0.1em; display: block; margin-bottom: 4px;">Duration</span>
                        <span style="font-size: 15px; font-weight: 700; color: #10B981; text-transform: capitalize;">{str(listing.get('rental_type', 'long-term')).replace('-', ' ')}</span>
                    </div>
                </div>
                <div style="margin-top: 10px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <span style="font-size: 10px; font-weight: 800; color: #BBBBBB; text-transform: uppercase; letter-spacing: 0.1em; display: block; margin-bottom: 4px;">AI Insight</span>
                    <p style="font-size: 14px; color: #EEEEEE; margin: 0; line-height: 1.6;">{listing.get('ai_summary', 'Fresh listing matching your alert criteria.')}</p>
                </div>
            </div>

            <a href="{listing.get('source_url')}" style="display: block; width: 100%; box-sizing: border-box; background-color: #FFFFFF; color: #000000; text-align: center; padding: 20px; border-radius: 16px; font-weight: 900; text-decoration: none; font-size: 13px; text-transform: uppercase; letter-spacing: 0.2em; transition: all 0.2s;">View Full Intel</a>
        </div>
    """)

def get_subscription_template(tier_name, user_name="Hunter"):
    return wrap_content(f"""
        <div style="padding: 0 40px 40px 40px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 20px;">🏹</div>
            <h1 style="font-size: 32px; font-weight: 900; margin: 0 0 16px 0; letter-spacing: -0.04em;">Welcome to the Elite, {user_name}.</h1>
            <p style="font-size: 16px; color: rgba(255,255,255,0.6); margin-bottom: 32px;">Your account has been upgraded to the <strong>{tier_name.upper()}</strong> tier. The Sniper Engine is now authorized to run high-frequency missions on your behalf.</p>
            
            <div style="background-color: #10B981; color: #000000; padding: 24px; border-radius: 24px; text-align: left; margin-bottom: 32px;">
                <h4 style="margin: 0 0 12px 0; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em;">Authorized Capabilities</h4>
                <ul style="margin: 0; padding: 0; list-style: none; font-size: 14px; font-weight: 700;">
                    <li style="margin-bottom: 8px;">✓ High-Frequency Scanning</li>
                    <li style="margin-bottom: 8px;">✓ Instant WhatsApp Signals</li>
                    <li style="margin-bottom: 8px;">✓ Multi-Area Coverage</li>
                    <li>✓ Priority Data Extraction</li>
                </ul>
            </div>

            <a href="https://home-seek.vercel.app/discover" style="display: block; width: 100%; box-sizing: border-box; background-color: rgba(255,255,255,0.05); color: #FFFFFF; text-align: center; padding: 20px; border-radius: 16px; font-weight: 900; text-decoration: none; font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; border: 1px solid rgba(255,255,255,0.1);">Enter Dashboard</a>
        </div>
    """)

def get_invoice_template(user_email, tier_name, amount, date=None):
    if not date: date = dt.datetime.now().strftime("%d %B %Y")
    inv_number = f"INV-{dt.datetime.now().strftime('%Y%m%d')}-{user_email[:3].upper()}"
    
    return wrap_content(f"""
        <div style="padding: 0 40px 40px 40px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px;">
                <div>
                    <h1 style="font-size: 24px; font-weight: 900; margin: 0; letter-spacing: -0.02em;">Invoice</h1>
                    <p style="font-size: 11px; color: rgba(255,255,255,0.4); margin: 4px 0 0 0;">{inv_number}</p>
                </div>
                <div style="text-align: right;">
                    <p style="font-size: 11px; font-weight: 800; color: rgba(255,255,255,0.3); text-transform: uppercase; margin: 0;">Date</p>
                    <p style="font-size: 13px; font-weight: 700; margin: 2px 0 0 0;">{date}</p>
                </div>
            </div>

            <div style="border: 1px solid rgba(255,255,255,0.05); border-radius: 20px; overflow: hidden;">
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                        <tr style="background-color: rgba(255,255,255,0.02);">
                            <th style="text-align: left; padding: 16px 20px; color: rgba(255,255,255,0.4); font-weight: 800; text-transform: uppercase; font-size: 9px; letter-spacing: 0.1em;">Description</th>
                            <th style="text-align: right; padding: 16px 20px; color: rgba(255,255,255,0.4); font-weight: 800; text-transform: uppercase; font-size: 9px; letter-spacing: 0.1em;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                                <span style="font-weight: 700; display: block;">HomeSeek Subscription</span>
                                <span style="font-size: 11px; color: rgba(255,255,255,0.4);">Tier: {tier_name.title()} (Monthly)</span>
                            </td>
                            <td style="padding: 20px; text-align: right; border-bottom: 1px solid rgba(255,255,255,0.05); font-weight: 700;">
                                R{amount:,.2f}
                            </td>
                        </tr>
                        <tr style="background-color: rgba(16, 185, 129, 0.05);">
                            <td style="padding: 20px; font-weight: 900; text-transform: uppercase; font-size: 10px; color: #10B981;">Total Paid</td>
                            <td style="padding: 20px; text-align: right; font-size: 18px; font-weight: 900; color: #10B981;">R{amount:,.2f}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div style="margin-top: 32px; padding: 20px; border-radius: 16px; background-color: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1); text-align: center;">
                <p style="font-size: 11px; color: rgba(255,255,255,0.5); margin: 0;">Payment processed via PayPal Secure. This is an automated receipt for your records.</p>
            </div>
        </div>
    """)
