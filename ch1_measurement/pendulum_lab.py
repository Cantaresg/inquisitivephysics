import streamlit as st
import plotly.graph_objects as go
import numpy as np

# 1. Layout Config
st.set_page_config(layout="wide", page_title="Physics Lab")
st.title("Chapter 2: Projectile Motion Lab")

# 2. Sidebar Controls
with st.sidebar:
    st.header("Launch Parameters")
    v0 = st.slider("Initial Velocity (m/s)", 10, 50, 30)
    angle_deg = st.slider("Launch Angle (deg)", 10, 80, 45)
    g = st.slider("Gravity (m/s²)", 1.6, 25.0, 9.8)
    
    st.header("Misconception Mode")
    aristotle = st.checkbox("Aristotelian Physics (No Inertia)")

# 3. Physics Calculation
angle_rad = np.radians(angle_deg)
t_hit = (2 * v0 * np.sin(angle_rad)) / g
t_points = np.linspace(0, t_hit, 40) # Number of frames

if aristotle:
    # Aristotle: Ball follows velocity vector, then falls vertically
    # We simulate this by stopping x-motion halfway
    t_half = t_hit / 2
    x = np.where(t_points < t_half, v0 * np.cos(angle_rad) * t_points, v0 * np.cos(angle_rad) * t_half)
    y = v0 * np.sin(angle_rad) * t_points - 0.5 * g * t_points**2
else:
    # Newtonian (Correct)
    x = v0 * np.cos(angle_rad) * t_points
    y = v0 * np.sin(angle_rad) * t_points - 0.5 * g * t_points**2

# 4. Create the Dashboard (L-Shape)
col_sim, col_graph = st.columns(2)

with col_sim:
    st.subheader("Animation Window")
    fig = go.Figure(
        data=[go.Scatter(x=[x[0]], y=[y[0]], mode="markers", marker=dict(size=15, color="red"))],
        layout=go.Layout(
            xaxis=dict(range=[0, max(x)+10], autorange=False, title="Distance (m)"),
            yaxis=dict(range=[0, max(y)+10], autorange=False, title="Height (m)"),
            updatemenus=[dict(type="buttons", buttons=[dict(label="Play", method="animate", args=[None, {"frame": {"duration": 50}}])])]
        ),
        frames=[go.Frame(data=[go.Scatter(x=[x[i]], y=[y[i]])]) for i in range(len(t_points))]
    )
    st.plotly_chart(fig, use_container_width=True)

with col_graph:
    st.subheader("Data Profile")
    traj_fig = go.Figure()
    traj_fig.add_trace(go.Scatter(x=x, y=y, name="Trajectory", line=dict(color='blue', dash='dash')))
    # FIX: Use 'yaxis_title' instead of 'ytitle'
    traj_fig.update_layout(xaxis_title="Distance (m)", yaxis_title="Height (m)")
    st.plotly_chart(traj_fig, use_container_width=True)
