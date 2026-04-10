from manim import *

class MarsCrash(Scene):
    def construct(self):
        # 1. Setup Mars and Craft
        mars = Dot(point=RIGHT*3, color=RED, radius=1.5)
        mars_label = Text("Mars", color=RED, font_size=36).next_to(mars, DOWN)
        
        craft = Dot(point=LEFT*5, color=GREY, radius=0.2)
        craft_label = Text("Orbiter", font_size=24).next_to(craft, UP)
        
        self.add(mars, mars_label, craft, craft_label)

        # 2. Show the "Code" mismatch
        code_box = Rectangle(height=2, width=5, color=WHITE).to_corner(UL)
        title = Text("Force Calculation", font_size=20).move_to(code_box.get_top() + DOWN*0.3)
        
        metric = Text("Team A: 445 Newtons", color=BLUE, font_size=24).move_to(code_box.get_center() + UP*0.2)
        imperial = Text("Team B: 445 Lbf (Units omitted!)", color=YELLOW, font_size=24).next_to(metric, DOWN)
        
        self.play(Create(code_box), Write(title))
        self.play(Write(metric))
        self.wait(1)
        self.play(Write(imperial))

        # 3. The Result (The Crash)
        # 1. Create the tracker and the moving label
        force_val = ValueTracker(445)
        
        # 2. Setup the number and text
        force_num = Integer(force_val.get_value(), num_decimal_places=0)
        units_label = Text(" N", font_size=24)
        force_display = VGroup(force_num, units_label).next_to(craft, DOWN)

        # 3. This "updater" makes the number follow the craft and update its value
        force_num.add_updater(lambda m: m.set_value(int(force_val.get_value())))
        force_display.add_updater(lambda m: m.next_to(craft, DOWN))
        
        self.add(force_display)

        # 4. Modified Crash Section
        self.play(
            craft.animate.move_to(mars.get_center()),
            # This makes the "445" climb to "1980" (the actual force in Newtons)
            force_val.animate.set_value(1980), 
            run_time=3,
            rate_func=rate_functions.ease_in_sine
        )
        
        # Stop the number from following the explosion
        force_display.clear_updaters()
        
        explosion = Star(color=ORANGE, outer_radius=2).move_to(mars.get_center())
        error_text = Text("MISSION LOST: Unit Mismatch", color=RED, font_size=36).to_edge(DOWN)
        
        self.play(Transform(craft, explosion), Write(error_text))
        self.wait(2)